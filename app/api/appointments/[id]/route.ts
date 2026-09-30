import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { appointmentStatusSchema } from "@/lib/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkCollision } from "@/lib/appointments";

export const maxDuration = 10;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { id } = await params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const parsed = appointmentStatusSchema.safeParse((json as Record<string, unknown>)?.status);
  if (!parsed.success) return NextResponse.json({ error: "Estado no válido." }, { status: 400 });
  const status = parsed.data;

  const supabase = createAdminClient();
  const { data: existing, error: fetchErr } = await supabase
    .from("appointments")
    .select("id, starts_at, duration_minutes, status")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr || !existing) return NextResponse.json({ error: "Cita no encontrada." }, { status: 404 });

  // Al confirmar, re-verificar choque 60min (evita aprobar dos solapadas)
  if (status === "confirmada") {
    const collision = await checkCollision(existing.starts_at, existing.duration_minutes);
    // Si hay colisión pero es la misma cita, ignorar
    if (collision.collision && collision.existing?.id !== id) {
      return NextResponse.json(
        { error: "No se puede confirmar: choca con otra cita confirmada/pendiente (intervalo 60 min)." },
        { status: 409 }
      );
    }
  }

  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", id);
  if (error) return NextResponse.json({ error: "No se pudo actualizar." }, { status: 500 });

  return NextResponse.json({ ok: true, id, status });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "No se pudo eliminar." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
