import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteSchedule, generateSlotsForDate, hasOverlap, isWithinWorkHours, localDateToUTC } from "@/lib/schedule";

export type AppointmentRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  property_id: string | null;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  status: string;
  source: string;
  notes: string | null;
  created_at: string;
};

export async function getAvailability(
  dateStr: string,
  duration = 60
): Promise<{ slots: { starts_at: string; available: boolean; reason?: string }[]; schedule: Awaited<ReturnType<typeof getSiteSchedule>> }> {
  const schedule = await getSiteSchedule();
  const dur = schedule.slot_durations.includes(duration) ? duration : schedule.slot_duration_default;
  const slotIsos = generateSlotsForDate(dateStr, schedule, dur);
  if (slotIsos.length === 0) return { slots: [], schedule };

  const supabase = createAdminClient();
  // Calcula el rango UTC de la fecha local de la instalación.
  const nextDay = new Date(`${dateStr}T12:00:00.000Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const nextStr = nextDay.toISOString().slice(0, 10);
  const dayStartUTC = localDateToUTC(dateStr, "00:00");
  const dayEndUTC = localDateToUTC(nextStr, "00:00");

  const { data: appointments } = await supabase
    .from("appointments")
    .select("starts_at, duration_minutes, status")
    .gte("starts_at", dayStartUTC)
    .lt("starts_at", dayEndUTC)
    .in("status", ["pendiente", "confirmada"]);

  const existing = (appointments ?? []).map((a) => ({
    start: new Date(a.starts_at),
    dur: a.duration_minutes,
  }));

  const slots = slotIsos.map((iso) => {
    const slotStart = new Date(iso);
    const blocked = existing.some((e) => hasOverlap(slotStart, dur, e.start, e.dur, schedule.buffer_minutes));
    // también verificar que no sea pasado
    const isPast = slotStart.getTime() < Date.now() + 30 * 60000;
    return {
      starts_at: iso,
      available: !blocked && !isPast,
      reason: isPast ? "past" : blocked ? "occupied" : undefined,
    };
  });

  return { slots, schedule };
}

export async function findNextAvailableSlots(
  fromDateStr: string,
  duration: number,
  limit = 3
): Promise<string[]> {
  const schedule = await getSiteSchedule();
  const dur = schedule.slot_durations.includes(duration) ? duration : schedule.slot_duration_default;
  const result: string[] = [];
  let cursor = new Date(`${fromDateStr}T12:00:00Z`);
  for (let d = 0; d < 14 && result.length < limit; d++) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const { slots } = await getAvailability(dateStr, dur);
    for (const s of slots) {
      if (s.available) {
        result.push(s.starts_at);
        if (result.length >= limit) break;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export async function checkCollision(
  startsAt: string,
  duration: number
): Promise<{ collision: boolean; existing?: AppointmentRow }> {
  const starts = new Date(startsAt);
  const schedule = await getSiteSchedule();
  const buffer = schedule.buffer_minutes;
  const supabase = createAdminClient();
  // Buscar un rango amplio y dejar que hasOverlap evalúe duración + buffer.
  // Un rango de solo ±buffer omitía citas largas que empezaban antes.
  const windowStart = new Date(starts.getTime() - 24 * 60 * 60000).toISOString();
  const windowEnd = new Date(starts.getTime() + 24 * 60 * 60000).toISOString();
  const { data } = await supabase
    .from("appointments")
    .select("*")
    .gte("starts_at", windowStart)
    .lt("starts_at", windowEnd)
    .in("status", ["pendiente", "confirmada"])
    .limit(5);

  for (const row of (data ?? []) as AppointmentRow[]) {
    const eStart = new Date(row.starts_at);
    if (hasOverlap(starts, duration, eStart, row.duration_minutes, buffer)) {
      return { collision: true, existing: row };
    }
  }
  return { collision: false };
}
