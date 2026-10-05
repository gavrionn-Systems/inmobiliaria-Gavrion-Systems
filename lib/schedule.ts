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

function timeZoneOffsetMinutes(date: Date): number {
  const value = new Intl.DateTimeFormat("en-US", {
    timeZone: SITE_TIMEZONE,
    timeZoneName: "shortOffset",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = /^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/.exec(value);
  if (!match || !match[1]) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === "+" ? minutes : -minutes;
}

/** Convierte una fecha y hora local de la instalación a UTC respetando su zona horaria. */
function localDateTimeToUTC(dateStr: string, time: string): string {
  const guess = new Date(`${dateStr}T${time}:00.000Z`);
  const offset = timeZoneOffsetMinutes(guess);
  return new Date(guess.getTime() - offset * 60000).toISOString();
}

function addCalendarDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function localDateParts(date: Date): { dateStr: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SITE_TIMEZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    dateStr: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

export function getDayKey(date: Date): keyof WorkHours {
  const d = date.getUTCDay(); // 0 Sun; callers pass a UTC-neutral date
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
  const base = new Date(`${dateStr}T12:00:00.000Z`); // neutral
  const key = getDayKey(base);
  const hours = schedule.work_hours[key];
  if (!hours) return [];
  const startMin = toMinutes(hours.start);
  const endMin = toMinutes(hours.end);
  const slots: string[] = [];
  for (let m = startMin; m + duration <= endMin; m += duration) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    slots.push(localDateTimeToUTC(dateStr, `${hh}:${mm}`));
  }
  return slots;
}

export function localDateToUTC(dateStr: string, time: string): string {
  return localDateTimeToUTC(dateStr, time);
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
  const bufferMs = Math.max(0, buffer) * 60000;
  const aEndWithBuffer = aEnd + bufferMs;
  const bEndWithBuffer = bEnd + bufferMs;
  return aStart.getTime() < bEndWithBuffer && bStart.getTime() < aEndWithBuffer;
}

export function isWithinWorkHours(
  startsAt: Date,
  duration: number,
  schedule: SiteSchedule
): boolean {
  // startsAt is UTC; se convierte a la zona horaria configurada.
  const local = localDateParts(startsAt);
  const dateStr = local.dateStr;
  const key = getDayKey(new Date(`${dateStr}T12:00:00.000Z`));
  const hours = schedule.work_hours[key];
  if (!hours) return false;
  const start = toMinutes(hours.start);
  const end = toMinutes(hours.end);
  return local.minutes >= start && local.minutes + duration <= end;
}
