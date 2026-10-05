import { NextResponse } from "next/server";
import { SITE_LOCALE, SITE_TIMEZONE } from "@/lib/site-locale";
import { headers } from "next/headers";
import { authorize } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { appointmentSchema } from "@/lib/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSiteSchedule, isWithinWorkHours } from "@/lib/schedule";
import { checkCollision, findNextAvailableSlots } from "@/lib/appointments";

export const maxDuration = 15;

export async function POST(request: Request) {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // Honeypot se valida después, pero rate limit igual
  if (!rateLimit(`appointment:${ip}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Ha enviado demasiadas solicitudes. Intente más tarde." },
      { status: 429 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = appointmentSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Honeypot
  if (data.empresa && data.empresa.trim().length > 0) {
    return NextResponse.json({ ok: true, honeypot: true });
  }

  const startsAt = new Date(data.starts_at);
  if (Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "Fecha no válida." }, { status: 400 });
  }
  // Debe ser futura +30min
  if (startsAt.getTime() < Date.now() + 30 * 60 * 1000) {
    return NextResponse.json(
      { error: "La fecha debe ser al menos 30 minutos en el futuro." },
      { status: 400 }
    );
  }
  if (startsAt.getTime() > Date.now() + 365 * 24 * 3600 * 1000) {
    return NextResponse.json({ error: "Fecha demasiado lejana." }, { status: 400 });
  }

  const schedule = await getSiteSchedule();
  const duration = schedule.slot_durations.includes(data.duration_minutes)
    ? data.duration_minutes
    : schedule.slot_duration_default;

  if (!isWithinWorkHours(startsAt, duration, schedule)) {
    return NextResponse.json(
      {
        error: `Fuera del horario laboral. Revise el horario disponible (${SITE_TIMEZONE}).`,
      },
      { status: 400 }
    );
  }

  // Verificación de choque con buffer 60min (o schedule.buffer_minutes)
  const collision = await checkCollision(startsAt.toISOString(), duration);
  if (collision.collision) {
    const nextSlots = await findNextAvailableSlots(
      startsAt.toISOString().slice(0, 10),
      duration,
      3
    );
    return NextResponse.json(
      {
        error: "Ese horario ya está reservado. Dejamos 60 min entre reuniones para evitar choques.",
        suggestions: nextSlots,
      },
      { status: 409 }
    );
  }

  // property_id validar opcional
  const supabaseAnon = await createClient();
  const supabase = createAdminClient();

  // Insertar (re-verificación race: si falla por constraint sería 409, pero usamos check lógico)
  const endsAt = new Date(startsAt.getTime() + duration * 60000).toISOString();
  const combinedNotes = data.motivo
    ? `[Motivo: ${data.motivo}]${data.notes ? ` ${data.notes}` : ""}`
    : data.notes || null;
  const { data: inserted, error } = await supabase
    .from("appointments")
    .insert({
      full_name: data.full_name,
      email: data.email || "",
      phone: data.phone || null,
      property_id: data.property_id || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt,
      duration_minutes: duration,
      status: "pendiente",
      source: "web",
      notes: combinedNotes,
    })
    .select("id, starts_at, ends_at")
    .single();

  if (error) {
    console.error("[appointments] insert error", error);
    // Si es choque por trigger concurrente, mapear a 409
    if (error.code === "23P01" || error.message.includes("overlap")) {
      const nextSlots = await findNextAvailableSlots(
        startsAt.toISOString().slice(0, 10),
        duration,
        3
      );
      return NextResponse.json(
        { error: "Ese horario se acaba de reservar. Pruebe otro.", suggestions: nextSlots },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "No se pudo crear la cita." }, { status: 500 });
  }

  // También crear una solicitud espejo para que el equipo la gestione desde el CRM.
  // No bloqueante
  try {
    await supabaseAnon.from("inquiries").insert({
      full_name: data.full_name,
      email: data.email || "",
      phone: data.phone || null,
      subject: `Solicitud de reunión presencial — ${new Date(startsAt).toLocaleString(SITE_LOCALE, { timeZone: SITE_TIMEZONE })}`,
      message: `Reunión presencial solicitada para ${startsAt.toISOString()} (${duration} min). Motivo: ${data.motivo}. Notas: ${data.notes || "—"}`,
      property_id: data.property_id || null,
      status: "nueva",
    });
  } catch {}

  return NextResponse.json(
    {
      ok: true,
      id: inserted.id,
      starts_at: inserted.starts_at,
      ends_at: inserted.ends_at,
      status: "pendiente",
      message: "Solicitud enviada. Un agente la confirmará pronto (aprobación humana).",
    },
    { status: 201 }
  );
}

export async function GET(request: Request) {
  const session = await authorize();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status");

  const supabase = createAdminClient();
  let q = supabase.from("appointments").select("*").order("starts_at", { ascending: true }).limit(100);
  if (from) q = q.gte("starts_at", from);
  if (to) q = q.lt("starts_at", to);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "No se pudo listar." }, { status: 500 });
  return NextResponse.json({ appointments: data });
}
