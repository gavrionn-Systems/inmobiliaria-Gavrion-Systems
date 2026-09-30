"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation";

export type TeamActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

const teamRoleSchema = z.enum(["admin", "agente"]);

const createMemberSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Escriba el nombre completo (mínimo 2 caracteres).")
    .max(120),
  email: z.email("Escriba un email válido.").max(160),
  phone: z.string().trim().max(40).optional(),
  role: teamRoleSchema,
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres.")
    .max(72),
});

const updateMemberSchema = z.object({
  id: z.uuid(),
  fullName: z
    .string()
    .trim()
    .min(2, "Escriba el nombre completo (mínimo 2 caracteres).")
    .max(120),
  email: z.email("Escriba un email válido.").max(160),
  phone: z.string().trim().max(40).optional(),
  role: teamRoleSchema,
  isActive: z.boolean(),
  password: z
    .string()
    .max(72)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))
    .refine(
      (value) => value === undefined || value.length >= 8,
      "La contraseña debe tener al menos 8 caracteres."
    ),
});

async function requireAdmin(): Promise<
  { ok: true; email: string } | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "No autorizado. Inicie sesión nuevamente." };
  }
  if (session.user.role !== "admin") {
    return { ok: false, error: "No tiene permisos para esta acción." };
  }
  return { ok: true, email: session.user.email };
}

function authErrorMessage(error: unknown, fallback: string): string {
  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message
      : "";
  const lower = message.toLowerCase();
  if (
    lower.includes("already") ||
    lower.includes("registered") ||
    lower.includes("exists")
  ) {
    return "Ya existe un usuario con ese email.";
  }
  if (lower.includes("invalid email")) {
    return "Escriba un email válido.";
  }
  if (lower.includes("password")) {
    return "La contraseña no cumple los requisitos de seguridad.";
  }
  console.error("[team-actions]", error);
  return fallback;
}

async function countActiveAdmins(
  supabase: ReturnType<typeof createAdminClient>,
  excludeId?: string
) {
  let query = supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("is_active", true);
  if (excludeId) query = query.neq("id", excludeId);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function upsertProfile(
  supabase: ReturnType<typeof createAdminClient>,
  row: {
    id: string;
    full_name: string;
    email: string;
    role: "admin" | "agente";
    is_active: boolean;
    phone: string | null;
  }
): Promise<TeamActionResult | null> {
  const patch = {
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    is_active: row.is_active,
    phone: row.phone,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", row.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[team-actions] Error al actualizar perfil:", error);
    return { ok: false, error: "No se pudo guardar el perfil. Intente de nuevo." };
  }
  if (data) return null;

  const { error: insertError } = await supabase.from("profiles").insert({
    id: row.id,
    ...patch,
  });
  if (insertError) {
    console.error("[team-actions] Error al crear perfil:", insertError);
    return { ok: false, error: "No se pudo crear el perfil. Intente de nuevo." };
  }
  return null;
}

function revalidateTeam(id?: string) {
  revalidatePath("/admin/equipo");
  if (id) revalidatePath(`/admin/equipo/${id}`);
  revalidatePath("/admin/crm/inbox");
  revalidatePath("/admin/crm/tareas");
  revalidatePath("/admin/crm/contactos");
}

export async function createTeamMember(input: {
  fullName: string;
  email: string;
  phone?: string;
  role: "admin" | "agente";
  password: string;
}): Promise<TeamActionResult> {
  const denied = await requireAdmin();
  if (!denied.ok) return denied;

  const parsed = createMemberSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const phone = parsed.data.phone?.trim() ? parsed.data.phone.trim() : null;
  const supabase = createAdminClient();

  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.fullName },
    });
  if (createError || !created.user) {
    return {
      ok: false,
      error: authErrorMessage(
        createError,
        "No se pudo crear el usuario. Intente de nuevo."
      ),
    };
  }

  const profileError = await upsertProfile(supabase, {
    id: created.user.id,
    full_name: parsed.data.fullName,
    email,
    role: parsed.data.role,
    is_active: true,
    phone,
  });
  if (profileError) {
    await supabase.auth.admin.deleteUser(created.user.id).catch((error) => {
      console.error("[team-actions] No se pudo revertir el usuario:", error);
    });
    return profileError;
  }

  revalidateTeam(created.user.id);
  await auditLog({ action: "team.member_created", entityType: "profile", entityId: created.user.id, metadata: { email, role: parsed.data.role } });
  return { ok: true, id: created.user.id };
}

export async function updateTeamMember(input: {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: "admin" | "agente";
  isActive: boolean;
  password?: string;
}): Promise<TeamActionResult> {
  const denied = await requireAdmin();
  if (!denied.ok) return denied;
  if (!uuidSchema.safeParse(input.id).success) {
    return { ok: false, error: "Identificador no válido." };
  }

  const parsed = updateMemberSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }

  const supabase = createAdminClient();
  const { data: current, error: currentError } = await supabase
    .from("profiles")
    .select("id, email, role, is_active")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (currentError) {
    console.error("[team-actions] Error al leer perfil:", currentError);
    return { ok: false, error: "No se pudo cargar el miembro." };
  }
  if (!current) {
    return { ok: false, error: "No se encontró ese miembro." };
  }

  const nextEmail = parsed.data.email.trim().toLowerCase();
  const wasActiveAdmin = current.role === "admin" && current.is_active;
  const willBeActiveAdmin =
    parsed.data.role === "admin" && parsed.data.isActive;
  const isSelf =
    current.email.trim().toLowerCase() === denied.email.trim().toLowerCase();

  if (isSelf && !parsed.data.isActive) {
    return { ok: false, error: "No puede desactivar su propia cuenta." };
  }

  if (wasActiveAdmin && !willBeActiveAdmin) {
    const remaining = await countActiveAdmins(supabase, current.id);
    if (remaining < 1) {
      return {
        ok: false,
        error: "Debe quedar al menos un administrador activo.",
      };
    }
  }

  const authPatch: { email?: string; password?: string; user_metadata?: { full_name: string } } = {
    user_metadata: { full_name: parsed.data.fullName },
  };
  if (nextEmail !== current.email.trim().toLowerCase()) {
    authPatch.email = nextEmail;
  }
  if (parsed.data.password) {
    authPatch.password = parsed.data.password;
  }

  const { error: authError } = await supabase.auth.admin.updateUserById(
    current.id,
    authPatch
  );
  if (authError) {
    return {
      ok: false,
      error: authErrorMessage(
        authError,
        "No se pudo actualizar el acceso. Intente de nuevo."
      ),
    };
  }

  const profileError = await upsertProfile(supabase, {
    id: current.id,
    full_name: parsed.data.fullName,
    email: nextEmail,
    role: parsed.data.role,
    is_active: parsed.data.isActive,
    phone: parsed.data.phone?.trim() ? parsed.data.phone.trim() : null,
  });
  if (profileError) return profileError;

  revalidateTeam(current.id);
  await auditLog({ action: "team.member_updated", entityType: "profile", entityId: current.id, metadata: { email: nextEmail, role: parsed.data.role, is_active: parsed.data.isActive } });
  return { ok: true, id: current.id };
}
