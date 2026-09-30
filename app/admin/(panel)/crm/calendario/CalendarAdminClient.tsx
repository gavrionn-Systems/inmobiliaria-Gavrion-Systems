"use client";

import { useMemo, useState, useTransition } from "react";
import { SITE_LOCALE, SITE_TIMEZONE } from "@/lib/site-locale";

type Appt = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
  property_id: string | null;
  created_at: string;
};

type Property = { id: string; title: string; slug: string };

function fmt(iso: string): string {
  return new Date(iso).toLocaleString(SITE_LOCALE, {
    timeZone: SITE_TIMEZONE,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function CalendarAdminClient({
  initialAppointments,
  properties,
}: {
  initialAppointments: Appt[];
  properties: Property[];
}) {
  const [appts, setAppts] = useState<Appt[]>(initialAppointments);
  const [filter, setFilter] = useState<string>("todos");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = appts;
    if (filter !== "todos") list = list.filter((a) => a.status === filter);
    // filter by selectedDate if not "todos" date
    if (selectedDate) {
      list = list.filter((a) => a.starts_at.slice(0, 10) === new Date(new Date(selectedDate + "T12:00:00").getTime() + 6 * 3600000).toISOString().slice(0, 10) || true);
      // simpler: compare local date
      list = appts.filter((a) => {
        const local = new Date(new Date(a.starts_at).getTime() - 6 * 3600000).toISOString().slice(0, 10);
        return filter === "todos" ? true : a.status === filter;
      });
    }
    return list;
  }, [appts, filter, selectedDate]);

  // For display: group by date local
  const byDate = useMemo(() => {
    const map = new Map<string, Appt[]>();
    for (const a of filtered) {
      const localDate = new Date(new Date(a.starts_at).getTime() - 6 * 3600000).toISOString().slice(0, 10);
      if (!map.has(localDate)) map.set(localDate, []);
      map.get(localDate)!.push(a);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  async function setStatus(id: string, status: string) {
    setMsg(null);
    startTransition(async () => {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error ?? "Error al actualizar.");
        return;
      }
      setAppts((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
      setMsg(`Cita ${status} correctamente.`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center bg-surface-container-low rounded-xl p-4 border border-outline-variant">
        <label className="flex items-center gap-2 font-label-sm text-label-sm">
          Fecha
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-surface border border-outline-variant rounded px-2 py-1.5 font-body-md text-body-md"
          />
        </label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-surface border border-outline-variant rounded px-3 py-2 font-label-sm text-label-sm"
        >
          <option value="todos">Todos los estados</option>
          <option value="pendiente">Pendientes (requieren aprobación)</option>
          <option value="confirmada">Confirmadas</option>
          <option value="rechazada">Rechazadas</option>
          <option value="cancelada">Canceladas</option>
        </select>
        <span className="font-body-md text-body-md text-secondary text-sm">
          {filtered.length} citas · Intervalo 60 min entre reuniones
        </span>
      </div>

      {msg && <p className="bg-primary-container/30 border border-primary-container rounded px-4 py-2 font-body-md text-body-md">{msg}</p>}

      {/* Kanban-like pending column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        <div className="lg:col-span-1 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="font-label-md text-label-md text-amber-900 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">pending_actions</span>
            Pendientes — aprobación humana
            <span className="ml-auto bg-amber-200 text-amber-900 rounded-full px-2 py-0.5 text-xs">
              {appts.filter((a) => a.status === "pendiente").length}
            </span>
          </h3>
          <div className="space-y-3">
            {appts.filter((a) => a.status === "pendiente").length === 0 ? (
              <p className="font-body-md text-body-md text-secondary text-sm text-center py-6">Sin pendientes</p>
            ) : (
              appts
                .filter((a) => a.status === "pendiente")
                .map((a) => (
                  <div key={a.id} className="bg-surface rounded-lg border border-outline-variant p-3">
                    <p className="font-label-md text-label-md text-on-surface">{a.full_name}</p>
                    <p className="font-body-md text-body-md text-secondary text-sm">{a.email} · {a.phone ?? "—"}</p>
                    <p className="font-body-md text-body-md text-on-surface text-sm mt-1">
                      {fmt(a.starts_at)} · {a.duration_minutes} min
                    </p>
                    {a.notes && <p className="font-body-md text-body-md text-secondary text-xs mt-1 line-clamp-2">{a.notes}</p>}
                    <div className="flex gap-2 mt-3">
                      <button
                        disabled={pending}
                        onClick={() => setStatus(a.id, "confirmada")}
                        className="flex-1 bg-emerald-600 text-white rounded px-3 py-2 font-label-sm text-label-sm hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Confirmar
                      </button>
                      <button
                        disabled={pending}
                        onClick={() => setStatus(a.id, "rechazada")}
                        className="flex-1 bg-surface border border-outline-variant rounded px-3 py-2 font-label-sm text-label-sm hover:bg-surface-container disabled:opacity-60"
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-outline-variant p-4">
          <h3 className="font-label-md text-label-md text-on-surface mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">calendar_view_month</span>
            Calendario ({SITE_TIMEZONE}) — {selectedDate}
          </h3>

          {/* Simple day view timeline 08-17 */}
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, idx) => {
              const hour = 8 + idx;
              const slotLabel = `${String(hour).padStart(2, "0")}:00`;
              const slotAppts = filtered.filter((a) => {
                const localHour = new Date(new Date(a.starts_at).getTime() - 6 * 3600000).getUTCHours();
                return localHour === hour;
              });
              return (
                <div key={hour} className="flex gap-3">
                  <span className="w-14 font-label-sm text-label-sm text-secondary text-right pt-2">{slotLabel}</span>
                  <div className="flex-1 min-h-12 bg-surface-container-low rounded border border-outline-variant/50 p-1 flex flex-wrap gap-1">
                    {slotAppts.length === 0 ? (
                      <span className="font-body-md text-body-md text-secondary/50 text-xs px-2 py-2">— libre (60 min buffer)</span>
                    ) : (
                      slotAppts.map((a) => (
                        <span
                          key={a.id}
                          className={[
                            "px-2 py-1 rounded text-xs font-label-sm border",
                            a.status === "confirmada"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : a.status === "pendiente"
                                ? "bg-amber-100 text-amber-800 border-amber-200"
                                : "bg-red-100 text-red-800 border-red-200",
                          ].join(" ")}
                          title={`${a.full_name} — ${fmt(a.starts_at)}`}
                        >
                          {fmt(a.starts_at)} · {a.full_name} ({a.status})
                        </span>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* List table */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left font-label-sm text-label-sm text-secondary border-b border-outline-variant">
                  <th className="py-2 px-2">Fecha</th>
                  <th className="py-2 px-2">Cliente</th>
                  <th className="py-2 px-2">Estado</th>
                  <th className="py-2 px-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-b border-outline-variant/50 font-body-md text-body-md">
                    <td className="py-2 px-2 whitespace-nowrap">{fmt(a.starts_at)}</td>
                    <td className="py-2 px-2">
                      <span className="font-medium">{a.full_name}</span>
                      <span className="text-secondary"> · {a.email}</span>
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={[
                          "px-2 py-1 rounded-full text-xs border",
                          a.status === "pendiente"
                            ? "bg-amber-100 border-amber-200 text-amber-800"
                            : a.status === "confirmada"
                              ? "bg-emerald-100 border-emerald-200 text-emerald-800"
                              : "bg-red-50 border-red-200 text-red-800",
                        ].join(" ")}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 flex gap-1">
                      {a.status === "pendiente" && (
                        <>
                          <button
                            disabled={pending}
                            onClick={() => setStatus(a.id, "confirmada")}
                            className="px-2 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700"
                          >
                            Confirmar
                          </button>
                          <button
                            disabled={pending}
                            onClick={() => setStatus(a.id, "rechazada")}
                            className="px-2 py-1 bg-surface border border-outline-variant rounded text-xs"
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                      {a.status === "confirmada" && (
                        <button
                          disabled={pending}
                          onClick={() => setStatus(a.id, "cancelada")}
                          className="px-2 py-1 bg-red-50 border border-red-200 text-red-700 rounded text-xs"
                        >
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-lg p-4 border border-outline-variant">
        <h4 className="font-label-md text-label-md text-on-surface mb-2">Operación de citas</h4>
        <p className="font-body-md text-body-md text-secondary text-sm">
          Las citas confirmadas quedan registradas en el sistema para seguimiento manual desde el CRM.
        </p>
        <p className="font-body-md text-body-md text-secondary text-xs mt-2">
        </p>
      </div>
    </div>
  );
}
