import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authenticateUser, createSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "desconocida";
  if (!rateLimit(`login:${ip}`, 5, 60_000)) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera un minuto y vuelve a intentar." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const user = await authenticateUser(email, password);
  if (!user) {
    return NextResponse.json(
      { error: "Credenciales incorrectas." },
      { status: 401 }
    );
  }

  try {
    await createSession(user);
  } catch {
    return NextResponse.json(
      { error: "Autenticación no configurada en el servidor." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    user: { name: user.name, email: user.email, role: user.role },
  });
}
