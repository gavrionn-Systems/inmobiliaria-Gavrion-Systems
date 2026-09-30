"use client";

import { useEffect, useMemo, useState } from "react";
import { SITE_LOCALE, SITE_TIMEZONE } from "@/lib/site-locale";

type Slot = { starts_at: string; available: boolean; reason?: string };

function formatSlot(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(SITE_LOCALE, {
    timeZone: SITE_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatLong(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(SITE_LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString(SITE_LOCALE, { month: "long", year: "numeric" });
}

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function startOfMonth(dateStr: string): Date {
  const [y, m] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

export default function AppointmentCalendar({
  duration,
  onSelect,
  selectedIso,
}: {
  duration: number;
  onSelect: (iso: string) => void;
  selectedIso: string | null;
}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [cursor, setCursor] = useState(() => startOfMonth(todayStr));
  const [selectedDate, setSelectedDate] = useState(() => todayStr);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch slots for selectedDate
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/appointments/availability?date=${selectedDate}&duration=${duration}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "No se pudo cargar");
        return r.json();
      })
      .then((json) => {
        if (!cancelled) setSlots(json.slots ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, duration]);

  const calendarDays = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const first = new Date(y, m, 1);
    // JS getDay: 0 Sun -> we want Monday first
    const jsDay = first.getDay(); // 0 Sun .. 6 Sat
    const mondayOffset = (jsDay + 6) % 7; // 0 if Monday
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < mondayOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push(iso);
    }
    // pad to 35 or 42
    while (cells.length % 7 !== 0) cells.push(null);
    while (cells.length < 35) cells.push(null);
    return cells;
  }, [cursor]);

  const availableCount = slots.filter((s) => s.available).length;

  function isPast(dateStr: string): boolean {
    return dateStr < todayStr;
  }
  function isSunday(dateStr: string): boolean {
    const d = new Date(`${dateStr}T12:00:00`);
    return d.getDay() === 0;
  }

  return (
    <div className="bg-surface-container-lowest rounded-[16px] border border-outline-variant shadow-[0_8px_32px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
      {/* Month header — impeccable tonal field */}
      <div className="px-5 md:px-6 pt-5 pb-4 bg-surface-container-low border-b border-outline-variant/60 flex items-center justify-between">
        <div>
          <h3 className="font-headline-md text-headline-md text-on-surface capitalize tracking-tight" style={{ letterSpacing: "-0.02em" }}>
            {formatMonth(cursor)}
          </h3>
          <p className="font-body-md text-body-md text-secondary text-sm mt-0.5">Horario laboral: Lun–Vie 8:00–17:00 · Sáb 8:00–12:00</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="w-9 h-9 rounded-full bg-surface border border-outline-variant flex items-center justify-center text-secondary hover:border-primary hover:text-on-surface transition-colors"
            aria-label="Mes anterior"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <button
            type="button"
            onClick={() => setCursor(startOfMonth(todayStr))}
            className="px-3 h-9 rounded-full bg-surface border border-outline-variant font-label-sm text-label-sm text-secondary hover:border-primary hover:text-on-surface transition-colors"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="w-9 h-9 rounded-full bg-surface border border-outline-variant flex items-center justify-center text-secondary hover:border-primary hover:text-on-surface transition-colors"
            aria-label="Mes siguiente"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Mini month grid */}
      <div className="px-3 md:px-5 pt-4">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map((w) => (
            <span key={w} className="text-center font-label-sm text-label-sm text-secondary/70 uppercase tracking-widest text-[11px] py-1">
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {calendarDays.map((iso, idx) => {
            if (!iso) return <div key={idx} className="h-10" />;
            const selected = iso === selectedDate;
            const past = isPast(iso);
            const sunday = isSunday(iso);
            const disabled = past || sunday;
            const dayNum = Number(iso.slice(8, 10));
            return (
              <button
                key={iso}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setSelectedDate(iso)}
                className={[
                  "relative h-10 rounded-xl font-label-md text-label-md transition-all duration-150 flex flex-col items-center justify-center",
                  selected
                    ? "bg-primary-container text-on-primary-container shadow-[0_2px_8px_rgba(164,198,57,0.35)] border border-primary-container"
                    : disabled
                      ? "bg-transparent text-secondary/30 cursor-not-allowed"
                      : "bg-surface border border-outline-variant/70 text-on-surface hover:border-primary-container hover:bg-primary-container/10 hover:shadow-sm",
                  past && !selected ? "opacity-50" : "",
                ].join(" ")}
                aria-label={iso}
                aria-selected={selected}
                title={sunday ? "Domingo — cerrado" : past ? "Fecha pasada" : undefined}
              >
                <span className="leading-none">{dayNum}</span>
                {!disabled && !selected && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary-container/70" aria-hidden />}
                {selected && <span className="absolute -bottom-0.5 w-6 h-0.5 rounded-full bg-on-primary-container/30" aria-hidden />}
              </button>
            );
          })}
        </div>
        <p className="font-body-md text-body-md text-secondary text-xs mt-3 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary-container inline-block" aria-hidden />
          Día laborable · domingo cerrado · 60′ entre reuniones
        </p>
      </div>

      {/* Divider */}
      <div className="h-px bg-outline-variant/60 mx-5 md:mx-6 mt-4" />

      {/* Selected day + slots */}
      <div className="px-5 md:px-6 py-5 flex-1">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h4 className="font-headline-md text-headline-md text-on-surface capitalize text-[18px] leading-tight">{formatLong(selectedDate)}</h4>
          {!loading && !error && slots.length > 0 && (
            <span className="font-label-sm text-label-sm text-secondary whitespace-nowrap">
              {availableCount} {availableCount === 1 ? "disponible" : "disponibles"}
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-[44px] rounded-xl bg-surface-container border border-outline-variant/50" />
            ))}
          </div>
        ) : error ? (
          <div role="alert" className="rounded-xl bg-error-container border border-error/20 px-4 py-3 flex gap-3">
            <span className="material-symbols-outlined text-error" aria-hidden>
              error
            </span>
            <p className="font-body-md text-body-md text-on-error-container text-sm">{error}</p>
          </div>
        ) : slots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-5 py-8 text-center">
            <span className="material-symbols-outlined text-3xl text-secondary/60 mb-2 block" aria-hidden>
              event_busy
            </span>
            <p className="font-body-md text-body-md text-on-surface font-medium">Sin horarios este día</p>
            <p className="font-body-md text-body-md text-secondary text-sm mt-1">Fuera de horario laboral o domingo. Pruebe el siguiente día laborable.</p>
            <button
              type="button"
              onClick={() => {
                const d = new Date(`${selectedDate}T12:00:00`);
                d.setDate(d.getDate() + 1);
                setSelectedDate(d.toISOString().slice(0, 10));
              }}
              className="mt-4 font-label-sm text-label-sm text-primary hover:underline"
            >
              Siguiente día →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5" role="grid" aria-label="Horarios">
            {slots.map((s) => {
              const isSelected = selectedIso === s.starts_at;
              return (
                <button
                  key={s.starts_at}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  disabled={!s.available}
                  onClick={() => s.available && onSelect(s.starts_at)}
                  className={[
                    "group relative h-[44px] rounded-xl border font-label-md text-label-md transition-all duration-200 flex items-center justify-center gap-1.5",
                    s.available
                      ? isSelected
                        ? "bg-primary text-on-primary border-primary shadow-[0_4px_16px_rgba(80,102,0,0.25)] scale-[1.02]"
                        : "bg-surface border-outline-variant text-on-surface hover:border-primary-container hover:bg-primary-container/12 hover:shadow-sm hover:-translate-y-px"
                      : "bg-surface-container border-outline-variant/50 text-secondary/45 cursor-not-allowed",
                  ].join(" ")}
                  title={s.available ? "Disponible — queda pendiente hasta confirmación" : s.reason === "past" ? "Ya pasó" : "Ocupado · buffer 60′"}
                >
                  {isSelected && (
                    <span className="material-symbols-outlined text-[16px] text-on-primary -ml-1" aria-hidden>
                      check_circle
                    </span>
                  )}
                  {formatSlot(s.starts_at)}
                  {!s.available && s.reason !== "past" && (
                    <span className="absolute inset-0 rounded-xl bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgba(0,0,0,0.04)_6px_7px)] pointer-events-none" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
        )}


      </div>
    </div>
  );
}
