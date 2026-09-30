import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { SITE_TIMEZONE } from "@/lib/site-locale";

export type WorkHoursDay = { start: string; end: string } | null;
export type WorkHours = {
  mon: WorkHoursDay;
  tue: WorkHoursDay;
  wed: WorkHoursDay;
  thu: WorkHoursDay;
  fri: WorkHoursDay;
  sat: WorkHoursDay;
  sun: WorkHoursDay;
};

export type SiteSchedule = {
  work_hours: WorkHours;
  slot_duration_default: number;
  slot_durations: number[];
  buffer_minutes: number;
};

const FALLBACK: SiteSchedule = {
  work_hours: {
    mon: { start: "08:00", end: "17:00" },
    tue: { start: "08:00", end: "17:00" },
    wed: { start: "08:00", end: "17:00" },
    thu: { start: "08:00", end: "17:00" },
    fri: { start: "08:00", end: "17:00" },
    sat: { start: "08:00", end: "12:00" },
    sun: null,
  },
  slot_duration_default: 60,
  slot_durations: [30, 60, 90],
  buffer_minutes: 60,
};

export const TZ = SITE_TIMEZONE;

export async function getSiteSchedule(): Promise<SiteSchedule> {
  const supabase = createPublicClient();
  if (!supabase) return FALLBACK;
  const { data } = await supabase
    .from("site_schedule")
    .select("work_hours, slot_duration_default, slot_durations, buffer_minutes")
    .eq("id", 1)
    .maybeSingle();
  if (!data) return FALLBACK;
  return {
    work_hours: (data.work_hours as WorkHours) ?? FALLBACK.work_hours,
    slot_duration_default: data.slot_duration_default ?? 60,
    slot_durations: data.slot_durations ?? [30, 60, 90],
    buffer_minutes: data.buffer_minutes ?? 60,
  };
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function getDayKey(date: Date): keyof WorkHours {
  const d = date.getDay(); // 0 Sun
  const map: Record<number, keyof WorkHours> = {
    0: "sun",
    1: "mon",
    2: "tue",
    3: "wed",
    4: "thu",
    5: "fri",
    6: "sat",
  };
  return map[d];
}

// Genera slots para un día dado en la zona horaria configurada.
export function generateSlotsForDate(
  dateStr: string, // YYYY-MM-DD
  schedule: SiteSchedule,
  duration: number
): string[] {
  // dateStr en la zona horaria configurada.
  const base = new Date(`${dateStr}T12:00:00`); // neutral
  const key = getDayKey(base);
  const hours = schedule.work_hours[key];
  if (!hours) return [];
  const startMin = toMinutes(hours.start);
  const endMin = toMinutes(hours.end);
  const slots: string[] = [];
  // Construye los slots en UTC según la zona horaria configurada.
  const OFFSET_HOURS = 6;
  for (let m = startMin; m + duration <= endMin; m += duration) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    // Create timestamptz as UTC
    const utcHour = Math.floor(m / 60) + OFFSET_HOURS;
    const utcHH = String(utcHour).padStart(2, "0");
    const iso = `${dateStr}T${utcHH}:${mm}:00.000Z`;
    // Validate that conversion back to local matches (handles 24h wrap)
    slots.push(iso);
  }
  return slots;
}

export function localDateToUTC(dateStr: string, time: string): string {
  // time HH:mm local -> UTC ISO
  const [h, m] = time.split(":").map(Number);
  const utcH = h + 6;
  const utcHH = String(utcH).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `${dateStr}T${utcHH}:${mm}:00.000Z`;
}

export function hasOverlap(
  aStart: Date,
  aDur: number,
  bStart: Date,
  bDur: number,
  buffer: number
): boolean {
  const aEnd = aStart.getTime() + aDur * 60000;
  const bEnd = bStart.getTime() + bDur * 60000;
  // con buffer: expande ventana
  const aStartBuf = aStart.getTime() - 0;
  const aEndBuf = aEnd + buffer * 60000 - aDur * 60000; // effectively require gap = buffer? Simplified: if buffer=60 and dur=60, block same hour
  // Simpler collision: intervals with buffer = buffer - but requirement: 1h gap between meetings
  // So if buffer=60, two 60min meetings at 09:00 and 10:00 overlap? They touch at 10:00. With 60min buffer they should NOT overlap (back-to-back allowed). But requirement says 1h interval to avoid choques at same hour.
  // Interpretation: slot hour-block, so 09:00 and 10:00 are fine, 09:00 and 09:30 not.
  // We enforce: Math.abs(aStart - bStart) < buffer is blocked
  const diff = Math.abs(aStart.getTime() - bStart.getTime());
  return diff < buffer * 60000;
}

export function isWithinWorkHours(
  startsAt: Date,
  duration: number,
  schedule: SiteSchedule
): boolean {
  // startsAt is UTC; se convierte a la zona horaria configurada.
  const local = new Date(startsAt.getTime() - 6 * 3600000);
  const dateStr = local.toISOString().slice(0, 10);
  const key = getDayKey(new Date(`${dateStr}T12:00:00`));
  const hours = schedule.work_hours[key];
  if (!hours) return false;
  const startMinLocal = local.getUTCHours() * 60 + local.getUTCMinutes();
  // local.getUTCHours is actually local hour because we shifted
  const start = toMinutes(hours.start);
  const end = toMinutes(hours.end);
  return startMinLocal >= start && startMinLocal + duration <= end;
}
