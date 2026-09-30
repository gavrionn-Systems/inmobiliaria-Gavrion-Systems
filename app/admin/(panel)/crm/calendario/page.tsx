import { authorize } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import CalendarAdminClient from "./CalendarAdminClient";

export const dynamic = "force-dynamic";

export default async function CalendarioPage() {
  const session = await authorize();
  if (!session) return null;

  const supabase = createAdminClient();
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, full_name, email, phone, starts_at, ends_at, duration_minutes, status, notes, property_id, created_at")
    .order("starts_at", { ascending: true })
    .limit(100);

  const { data: properties } = await supabase
    .from("properties")
    .select("id, title, slug")
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">calendar_month</span>
          Calendario — Reuniones Presenciales
        </h1>
        <p className="font-body-md text-body-md text-secondary">
          Gestione las solicitudes de reunión presencial. Las nuevas quedan <strong>pendientes</strong> hasta aprobación humana. Al confirmar, el sistema verifica la disponibilidad y registra la cita.
        </p>
        <div className="flex gap-2 text-xs font-label-sm">
          <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">pendiente — requiere acción</span>
          <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">confirmada</span>
          <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 border border-red-200">cancelada/rechazada</span>
        </div>
      </div>

      <CalendarAdminClient
        initialAppointments={(appointments ?? []) as never}
        properties={(properties ?? []) as never}
      />
    </div>
  );
}
