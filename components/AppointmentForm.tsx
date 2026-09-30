"use client";

import { useState, useTransition } from "react";
import { SITE_LOCALE, SITE_TIMEZONE } from "@/lib/site-locale";

type Props = {
  selectedIso: string | null;
  duration: number;
  onDurationChange: (d: number) => void;
  allowedDurations: number[];
};

function fmtSelected(iso: string | null, duration: number): { line1: string; line2: string } | null {
  if (!iso) return null;
  const start = new Date(iso);
  const end = new Date(start.getTime() + duration * 60000);
  const d = start.toLocaleDateString(SITE_LOCALE, {
    timeZone: SITE_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const t1 = start.toLocaleTimeString(SITE_LOCALE, { timeZone: SITE_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false });
  const t2 = end.toLocaleTimeString(SITE_LOCALE, { timeZone: SITE_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false });
  return { line1: d.charAt(0).toUpperCase() + d.slice(1), line2: `${t1} → ${t2} · ${duration} min` };
}

const MOTIVOS = [
  "Comprar propiedad",
  "Vender propiedad",
  "Alquilar",
  "Poner en alquiler",
  "Asesoría / Inversión",
  "Visita a propiedad",
  "Otro",
] as const;

export default function AppointmentForm({ selectedIso, duration, onDurationChange, allowedDurations }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [success, setSuccess] = useState<{ id: string; starts_at: string } | null>(null);

  const selected = fmtSelected(selectedIso, duration);

  if (success) {
    const when = new Date(success.starts_at).toLocaleString(SITE_LOCALE, {
      timeZone: SITE_TIMEZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return (
      <div className="rounded-[16px] border border-primary-container bg-primary-container/15 overflow-hidden">
        <div className="bg-primary-container text-on-primary-container px-6 py-4 flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-surface flex items-center justify-center text-primary shrink-0" aria-hidden>
            <span className="material-symbols-outlined">event_available</span>
          </span>
          <div>
            <h3 className="font-headline-md text-headline-md text-on-primary-container leading-none">¡Solicitud enviada!</h3>
            <p className="font-body-md text-body-md text-on-primary-container/80 text-sm">Pendiente de confirmación humana</p>
          </div>
        </div>
        <div className="px-6 py-6 bg-surface-container-lowest">
          <p className="font-body-md text-body-md text-on-surface">
            Su reunión para el <strong className="capitalize">{when}</strong> quedó{" "}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 font-label-sm text-[11px] tracking-wide">
              pendiente
            </span>
            .
          </p>
          <p className="font-body-md text-body-md text-secondary text-sm mt-2 leading-relaxed">
            Un asesor la revisará en <strong>/admin/crm/calendario</strong> y se pondrá en contacto con usted para confirmar los detalles.
          </p>
          <div className="mt-5 flex gap-2">
            <a
              href="/contacto"
              onClick={(e) => {
                e.preventDefault();
                setSuccess(null);
              }}
              className="font-label-sm text-label-sm text-primary hover:underline"
            >
              Agendar otra →
            </a>
          </div>
        </div>
      </div>
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuggestions([]);
    if (!selectedIso) {
      setError("Seleccione un horario en el calendario, arriba.");
      return;
    }
    const form = new FormData(e.currentTarget);
    const motivo = String(form.get("motivo") ?? "");
    if (!motivo) {
      setError("Seleccione el motivo de la reunión.");
      return;
    }
    const payload = {
      full_name: String(form.get("nombre") ?? ""),
      email: String(form.get("email") ?? "").trim(),
      phone: String(form.get("telefono") ?? "") || null,
      property_id: null,
      starts_at: selectedIso,
      duration_minutes: duration,
      motivo,
      notes: String(form.get("notas") ?? ""),
      empresa: String(form.get("empresa") ?? ""),
    };
    startTransition(async () => {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "No se pudo agendar.");
        if (json.suggestions?.length) setSuggestions(json.suggestions);
        return;
      }
      setSuccess({ id: json.id, starts_at: json.starts_at });
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-[16px] border border-outline-variant bg-surface-container-lowest shadow-[0_8px_32px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col"
      noValidate
    >
      {/* Card header — selected slot */}
      <div className="px-6 pt-6 pb-4">
        <h3 className="font-headline-md text-headline-md text-on-surface tracking-tight" style={{ letterSpacing: "-0.015em" }}>
          Confirme sus datos
        </h3>
        <p className="font-body-md text-body-md text-secondary text-sm mt-1">Usamos el mismo tono que la oficina: claro, sin rodeos.</p>
      </div>

      <div
        className={[
          "mx-6 rounded-xl border px-4 py-4 flex items-center gap-3 transition-colors",
          selected
            ? "bg-primary border-primary text-on-primary"
            : "bg-surface-container border-outline-variant text-secondary border-dashed",
        ].join(" ")}
      >
        <span
          className={[
            "w-10 h-10 rounded-full flex items-center justify-center shrink-0 border",
            selected ? "bg-surface text-primary border-primary-container" : "bg-surface-container-low text-secondary border-outline-variant",
          ].join(" ")}
          aria-hidden
        >
          <span className="material-symbols-outlined text-[20px]">schedule</span>
        </span>
        <div className="min-w-0">
          <p className={["font-label-sm text-label-sm uppercase tracking-widest", selected ? "text-on-primary/80" : "text-secondary"].join(" ")}>
            Horario seleccionado
          </p>
          {selected ? (
            <>
              <p className="font-label-md text-label-md text-on-primary capitalize truncate">{selected.line1}</p>
              <p className="font-body-md text-body-md text-on-primary/90 text-sm">{selected.line2}</p>
            </>
          ) : (
            <p className="font-body-md text-body-md text-secondary text-sm">Toque un horario en el calendario →</p>
          )}
        </div>
      </div>

      {/* Duration selector — only if more than one */}
      {allowedDurations.length > 1 && (
        <div className="px-6 pt-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-label-sm text-label-sm text-secondary">Duración</span>
            <div className="flex gap-2">
              {allowedDurations.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onDurationChange(d)}
                  className={[
                    "flex-1 rounded-full border px-3 py-2.5 font-label-md text-label-md transition-colors",
                    duration === d
                      ? "bg-primary-container border-primary-container text-on-primary-container"
                      : "bg-surface border-outline-variant text-secondary hover:border-primary-container",
                  ].join(" ")}
                >
                  {d}′
                </button>
              ))}
            </div>
          </label>
        </div>
      )}

      {/* Error */}
      {error && (
        <div role="alert" className="mx-6 mt-4 rounded-xl bg-error-container border border-error/15 px-4 py-3">
          <p className="font-body-md text-body-md text-on-error-container text-sm flex gap-2">
            <span className="material-symbols-outlined text-[18px] mt-0.5 shrink-0" aria-hidden>
              warning
            </span>
            <span>{error}</span>
          </p>
          {suggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((iso) => (
                <span key={iso} className="rounded-full bg-surface border border-outline-variant px-3 py-1 font-label-sm text-label-sm text-on-surface text-xs">
                  {new Date(iso).toLocaleString(SITE_LOCALE, {
                    timeZone: SITE_TIMEZONE,
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Honeypot */}
      <input type="text" name="empresa" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <div className="px-6 pt-5 pb-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5 group">
            <span className="font-label-sm text-label-sm text-secondary group-focus-within:text-primary transition-colors">Nombre completo *</span>
            <input
              name="nombre"
              required
              placeholder="Ana López"
              autoComplete="name"
              className="bg-surface rounded-xl border border-outline-variant px-3.5 py-3 font-body-md text-body-md text-on-surface placeholder:text-secondary/60 focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none transition-all"
            />
          </label>
          <label className="flex flex-col gap-1.5 group">
            <span className="font-label-sm text-label-sm text-secondary group-focus-within:text-primary transition-colors">Email (opcional)</span>
            <input
              name="email"
              type="email"
              placeholder="ana@correo.com"
              autoComplete="email"
              className="bg-surface rounded-xl border border-outline-variant px-3.5 py-3 font-body-md text-body-md text-on-surface placeholder:text-secondary/60 focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none transition-all"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5 group">
          <span className="font-label-sm text-label-sm text-secondary group-focus-within:text-primary transition-colors">Teléfono · WhatsApp</span>
          <input
            name="telefono"
            type="tel"
            placeholder="+504 9961-5803"
            autoComplete="tel"
            className="bg-surface rounded-xl border border-outline-variant px-3.5 py-3 font-body-md text-body-md text-on-surface placeholder:text-secondary/60 focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none transition-all"
          />
        </label>

        <div className="rounded-xl border border-outline-variant bg-surface-container/30 p-4 space-y-3">
          <p className="font-label-md text-label-md text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]" aria-hidden>description</span>
            Motivo de la reunión *
          </p>
          <label className="flex flex-col gap-1.5 group">
            <span className="font-label-sm text-label-sm text-secondary group-focus-within:text-primary transition-colors">Motivo *</span>
            <select
              name="motivo"
              required
              defaultValue=""
              className="bg-surface rounded-xl border border-outline-variant px-3.5 py-3 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none transition-all"
            >
              <option value="" disabled>Seleccione un motivo</option>
              {MOTIVOS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 group">
            <span className="font-label-sm text-label-sm text-secondary group-focus-within:text-primary transition-colors">Detalles (opcional)</span>
            <textarea
              name="notas"
              rows={3}
                    placeholder="Ej. Indique cualquier detalle que debamos conocer..."
              className="bg-surface rounded-xl border border-outline-variant px-3.5 py-3 font-body-md text-body-md text-on-surface placeholder:text-secondary/60 focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none resize-y min-h-[88px] transition-all"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={pending || !selectedIso}
          className="w-full rounded-full bg-primary-container text-on-primary-container font-label-md text-label-md px-8 py-3.5 hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-45 disabled:cursor-not-allowed shadow-[0_4px_16px_rgba(164,198,57,0.35)] flex items-center justify-center gap-2"
        >
          {pending ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-on-primary-container/30 border-t-on-primary-container animate-spin" aria-hidden />
              Enviando…
            </>
          ) : (
            <>
              Solicitar reunión
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                arrow_forward
              </span>
            </>
          )}
        </button>


      </div>
    </form>
  );
}
