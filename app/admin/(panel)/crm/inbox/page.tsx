import Link from "next/link";
import { isBankAdvisoryRequest } from "@/lib/bank-advisory";
import { getProfiles } from "@/lib/admin-queries";
import { getCrmInbox } from "@/lib/crm-queries";
import { channelLabel, formatDate } from "@/lib/format";

export const metadata = { title: "Inbox CRM · Admin" };

const statusLabel: Record<string, string> = {
  abierta: "Abierta",
  pendiente: "Pendiente",
  cerrada: "Cerrada",
};

function param(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default async function CrmInboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = {
    channel: param(params.canal),
    status: param(params.estado),
    assignee: param(params.responsable),
    q: param(params.q),
  };
  const [conversations, profiles] = await Promise.all([
    getCrmInbox(filters),
    getProfiles(),
  ]);
  const activeProfiles = profiles.filter((profile) => profile.is_active);
  const hasFilters = Boolean(
    filters.channel || filters.status || filters.assignee || filters.q
  );

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-1">
            Inbox
          </h1>
          <p className="font-body-md text-body-md text-secondary">
            Conversaciones de WhatsApp, Messenger, Instagram y solicitudes web,
            incluidas las sin asignar. Las solicitudes de asesoría bancaria se
            redirigen automáticamente aquí desde Solicitudes y se atienden de
            forma manual.
          </p>
        </div>
        <p className="font-label-sm text-label-sm text-secondary">
          {conversations.length} conversaciones visibles
        </p>
      </header>

      <form
        method="get"
        className="mb-6 grid gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-4 sm:grid-cols-2 xl:grid-cols-5"
      >
        <label className="flex flex-col gap-1 font-label-sm text-label-sm text-secondary">
          Buscar
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            maxLength={80}
            placeholder="Nombre o teléfono"
            className="bg-surface rounded border border-outline-variant px-3 py-2 font-body-md text-body-md text-on-surface focus:border-primary outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 font-label-sm text-label-sm text-secondary">
          Canal
          <select
            name="canal"
            defaultValue={filters.channel}
            className="bg-surface rounded border border-outline-variant px-3 py-2 font-body-md text-body-md text-on-surface focus:border-primary outline-none"
          >
            <option value="">Todos</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="web">Web</option>
            <option value="instagram">Instagram</option>
            <option value="messenger">Messenger</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 font-label-sm text-label-sm text-secondary">
          Estado
          <select
            name="estado"
            defaultValue={filters.status}
            className="bg-surface rounded border border-outline-variant px-3 py-2 font-body-md text-body-md text-on-surface focus:border-primary outline-none"
          >
            <option value="">Todos</option>
            <option value="abierta">Abierta</option>
            <option value="pendiente">Pendiente</option>
            <option value="cerrada">Cerrada</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 font-label-sm text-label-sm text-secondary">
          Responsable
          <select
            name="responsable"
            defaultValue={filters.assignee}
            className="bg-surface rounded border border-outline-variant px-3 py-2 font-body-md text-body-md text-on-surface focus:border-primary outline-none"
          >
            <option value="">Todos</option>
            <option value="none">Sin asignar</option>
            {activeProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.full_name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="bg-primary text-on-primary rounded px-4 py-2 font-label-md text-label-md"
          >
            Filtrar
          </button>
          {hasFilters && (
            <Link
              href="/admin/crm/inbox"
              className="px-3 py-2 font-label-md text-label-md text-secondary hover:text-on-surface"
            >
              Limpiar
            </Link>
          )}
        </div>
      </form>

      {conversations.length === 0 ? (
        <div className="border border-dashed border-outline-variant rounded-lg px-6 py-12 text-center">
          <span
            className="material-symbols-outlined text-4xl text-secondary"
            aria-hidden="true"
          >
            inbox
          </span>
          <h2 className="mt-3 font-headline-md text-headline-md text-on-surface">
            {hasFilters ? "Sin resultados con estos filtros" : "La bandeja está al día"}
          </h2>
          <p className="mt-2 font-body-md text-body-md text-secondary max-w-lg mx-auto">
            {hasFilters
              ? "Pruebe con otros criterios o limpie los filtros."
              : "Las conversaciones aparecerán cuando llegue un mensaje de WhatsApp, Messenger, Instagram o una solicitud desde el sitio."}
          </p>
        </div>
      ) : (
        <div className="border border-outline-variant rounded-lg bg-surface-container-lowest divide-y divide-outline-variant">
          {conversations.map((conversation) => {
            const contact = conversation.contact;
            const latest = conversation.latest_message;
            return (
              <Link
                key={conversation.id}
                href={`/admin/crm/inbox/${conversation.id}`}
                className="grid gap-3 px-4 py-4 hover:bg-surface-container-low transition-colors sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-label-md text-label-md text-on-surface truncate">
                      {contact?.full_name ?? "Contacto sin nombre"}
                    </h2>
                    <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
                      {channelLabel(conversation.channel)}
                    </span>
                    {isBankAdvisoryRequest(latest?.body) && (
                      <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
                        Asesoría bancaria · gestión manual
                      </span>
                    )}
                    {conversation.bot_mode === "manual" && (
                      <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container">
                        IA desactivada
                      </span>
                    )}
                    {conversation.status !== "cerrada" && (
                      <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container">
                        {statusLabel[conversation.status]}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-body-md text-body-md text-secondary truncate">
                    {latest?.body ??
                      (latest?.message_type
                        ? `[${latest.message_type}]`
                        : "Sin mensajes")}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="font-label-sm text-label-sm text-secondary">
                    {conversation.last_message_at
                      ? formatDate(conversation.last_message_at)
                      : "Sin actividad"}
                  </p>
                  <p className="mt-1 font-label-sm text-label-sm text-on-surface-variant">
                    {conversation.assignee?.full_name ?? "Sin asignar"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
