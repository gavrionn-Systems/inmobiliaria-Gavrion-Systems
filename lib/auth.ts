import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import {
  DEMO_EMPLOYEE,
  DEMO_TEMPLATE_ADMIN,
  DEMO_SESSION_COOKIE,
  DEMO_USER,
  DEV_FALLBACK_PASSWORD,
  type DemoRole,
} from "./demo-auth";
import { isDemoRole } from "./rbac";
import { createAdminClient } from "./supabase/admin";
import {
  sessionSecret,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./session-token";

export interface SessionUser {
  id?: string;
  name: string;
  email: string;
  role: DemoRole;
}

export interface Session {
  user: SessionUser;
}

const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 horas

/** Comparación en tiempo constante: hashea ambos lados para igualar longitud. */
function safeEqualPassword(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function passwordFor(
  envValue: string | undefined
): string | undefined {
  return (
    envValue ??
    (process.env.NODE_ENV === "production" ? undefined : DEV_FALLBACK_PASSWORD)
  );
}

function accounts(): Array<{
  user: SessionUser;
  email: string;
  password: string | undefined;
}> {
  return [
    {
      user: {
        name: DEMO_TEMPLATE_ADMIN.name,
        email: (process.env.TEMPLATE_ADMIN_EMAIL ?? DEMO_TEMPLATE_ADMIN.email)
          .trim()
          .toLowerCase(),
        role: DEMO_TEMPLATE_ADMIN.role,
      },
      email: (process.env.TEMPLATE_ADMIN_EMAIL ?? DEMO_TEMPLATE_ADMIN.email)
        .trim()
        .toLowerCase(),
      password: passwordFor(process.env.TEMPLATE_ADMIN_PASSWORD),
    },
    {
      user: {
        name: DEMO_USER.name,
        email: (process.env.ADMIN_EMAIL ?? DEMO_USER.email).trim().toLowerCase(),
        role: DEMO_USER.role,
      },
      email: (process.env.ADMIN_EMAIL ?? DEMO_USER.email).trim().toLowerCase(),
      password: passwordFor(process.env.ADMIN_PASSWORD),
    },
    {
      user: {
        name: DEMO_EMPLOYEE.name,
        email: (process.env.EMPLOYEE_EMAIL ?? DEMO_EMPLOYEE.email)
          .trim()
          .toLowerCase(),
        role: DEMO_EMPLOYEE.role,
      },
      email: (process.env.EMPLOYEE_EMAIL ?? DEMO_EMPLOYEE.email)
        .trim()
        .toLowerCase(),
      password: passwordFor(process.env.EMPLOYEE_PASSWORD),
    },
  ];
}

export function verifyCredentials(
  email: string,
  password: string
): SessionUser | null {
  const inputEmail = email.trim().toLowerCase();
  for (const account of accounts()) {
    if (!account.password) continue;
    if (inputEmail === account.email && safeEqualPassword(password, account.password)) {
      return account.user;
    }
  }
  return null;
}

async function verifySupabaseCredentials(
  email: string,
  password: string
): Promise<SessionUser | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || !password) return null;

  const authClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await authClient.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user) return null;

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("full_name, email, role, is_active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError || !profile?.is_active) return null;
  if (
    profile.role !== "template_admin" &&
    profile.role !== "designer" &&
    profile.role !== "admin" &&
    profile.role !== "agente"
  ) return null;

  return {
    id: data.user.id,
    name: profile.full_name,
    email: profile.email,
    role: profile.role,
  };
}

/** Primero las cuentas del .env; si fallan, Auth de Supabase + perfil activo. */
export async function authenticateUser(
  email: string,
  password: string
): Promise<SessionUser | null> {
  const inputEmail = email.trim().toLowerCase();
  if (!inputEmail || !password) return null;
  const envUser = verifyCredentials(inputEmail, password);
  if (envUser) return envUser;
  return verifySupabaseCredentials(inputEmail, password);
}

export async function getSession(): Promise<Session | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  const store = await cookies();
  const token = store.get(DEMO_SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token, secret);
  if (!payload) return null;
  if (!isDemoRole(payload.role)) return null;
    return {
      user: { id: payload.id, name: payload.name, email: payload.sub, role: payload.role },
    };
}

export async function authorize(
  allowedRoles: readonly DemoRole[] = ["admin", "agente"]
): Promise<Session | null> {
  const session = await getSession();
  return session && allowedRoles.includes(session.user.role) ? session : null;
}

export async function createSession(user: SessionUser) {
  const secret = sessionSecret();
  if (!secret) {
    throw new Error("AUTH_SECRET no está configurado en el servidor.");
  }
  const payload: SessionPayload = {
    sub: user.email,
    name: user.name,
    role: user.role,
    id: user.id,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  };
  const token = await signSessionToken(payload, secret);
  const store = await cookies();
  store.set(DEMO_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(DEMO_SESSION_COOKIE);
}
