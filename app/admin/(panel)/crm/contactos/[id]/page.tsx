import Link from "next/link";
import { notFound } from "next/navigation";
import ContactEditForm from "@/components/admin/crm/ContactEditForm";
import ContactConsentActions from "@/components/admin/crm/ContactConsentActions";
import { getProfiles } from "@/lib/admin-queries";
import { getSession } from "@/lib/auth";
import { getCrmContact } from "@/lib/crm-queries";
import { formatDate, leadSourceLabel } from "@/lib/format";

export const metadata = { title: "Contacto CRM · Admin" };

const conversationStatusLabel: Record<string, string> = {
  abierta: "Abierta",
  pendiente: "Pendiente",
  cerrada: "Cerrada",
};

const opportunityStatusLabel: Record<string, string> = {
  abierta: "Abierta",
  ganada: "Ganada",
  perdida: "Perdida",
};

const taskStatusLabel: Record<string, string> = {
  pendiente: "Pendiente",
  completada: "Completada",
  cancelada: "Cancelada",
};

const consentCategoryLabel: Record<string, string> = {
  service: "Servicio",
  utility: "Utilidad",
  marketing: "Marketing",
};

export default async function CrmContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [contact, session] = await Promise.all([
    getCrmContact(id),
    getSession(),
  ]);
  if (!contact) notFound();

  const isAdmin = session?.user.role === "admin";
  const profiles = isAdmin
    ? (await getProfiles())
        .filter((profile) => profile.is_active)
        .map((profile) => ({ id: profile.id, full_name: profile.full_name }))
    : [];

  return (
    <>
      <div className="mb-5">
        <Link
          href="/admin/crm/contactos"
          className="inline-flex items-center gap-1 font-label-md text-label-md text-primary hover:text-on-primary-container"
        >
          <span className="material-symbols-outlined text-xl" aria-hidden="true">
            arrow_back
          </span>
          Volver a contactos
        </Link>
      </div>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            {contact.full_name}
          </h1>
          <span className="rounded-full bg-primary-container px-2 py-1 font-label-sm text-label-sm text-on-primary-container">
            {contact.status}
          </span>
          {contact.suppression && (
            <span className="rounded-full bg-error-container px-2 py-1 font-label-sm text-label-sm text-on-error-container">
              Baja de mensajes
            </span>
          )}
        </div>
        <p className="mt-1 font-body-md text-body-md text-secondary">
          Origen: {leadSourceLabel(contact.source)} · Creado el{" "}
          {formatDate(contact.created_at)} · Responsable:{" "}
          {contact.assignee?.full_name ?? "Sin asignar"}
        </p>
      </header>

      <ContactEditForm
        contact={{
          id: contact.id,
          full_name: contact.full_name,
          email: contact.email,
          phone: contact.phone,
          notes: contact.notes,
          status: contact.status,
          assigned_to: contact.assigned_to,
        }}
        profiles={profiles}
        canAssign={isAdmin}
        suppressed={Boolean(contact.suppression)}
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-headline-md text-headline-md text-on-surface">
            Conversaciones
          </h2>
          {contact.conversations.length === 0 ? (
            <p className="border border-dashed border-outline-variant rounded-lg p-6 text-secondary">
              Sin conversaciones registradas.
            </p>
          ) : (
            <div className="border border-outline-variant rounded-lg bg-surface-container-lowest divide-y divide-outline-variant">
              {contact.conversations.map((conversation) => (
                <Link
                  key={conversation.id}
                  href={`/admin/crm/inbox/${conversation.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors"
                >
                  <span className="font-label-md text-label-md text-on-surface">
                    {conversation.channel === "whatsapp" ? "WhatsApp" : "Web"} ·{" "}
                    {conversationStatusLabel[conversation.status] ??
                      conversation.status}
                  </span>
                  <span className="font-label-sm text-label-sm text-secondary">
                    {conversation.last_message_at
                      ? formatDate(conversation.last_message_at)
                      : "Sin actividad"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-headline-md text-headline-md text-on-surface">
            Oportunidades
          </h2>
          {contact.opportunities.length === 0 ? (
            <p className="border border-dashed border-outline-variant rounded-lg p-6 text-secondary">
              Sin oportunidades registradas.
            </p>
          ) : (
            <div className="border border-outline-variant rounded-lg bg-surface-container-lowest divide-y divide-outline-variant">
              {contact.opportunities.map((opportunity) => (
                <article key={opportunity.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-label-md text-label-md text-on-surface">
                      {opportunity.title}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 font-label-sm text-label-sm ${
                        opportunity.status === "ganada"
                          ? "bg-primary-container text-on-primary-container"
                          : opportunity.status === "perdida"
                            ? "bg-error-container text-on-error-container"
                            : "bg-surface-container-high text-on-surface-variant"
                      }`}
                    >
                      {opportunityStatusLabel[opportunity.status] ??
                        opportunity.status}
                    </span>
                  </div>
                  <p className="mt-1 font-label-sm text-label-sm text-secondary">
                    {opportunity.stage?.name ?? "Sin etapa"}
                    {opportunity.value !== null &&
                      ` · ${new Intl.NumberFormat(process.env.NEXT_PUBLIC_SITE_LOCALE || "es", {
                        style: "currency",
                        currency: opportunity.currency,
                        maximumFractionDigits: 0,
                      }).format(Number(opportunity.value))}`}
                    {opportunity.expected_close_at &&
                      ` · Cierre estimado: ${formatDate(opportunity.expected_close_at)}`}
                  </p>
                  {opportunity.property && (
                    <Link
                      href={`/propiedades/${opportunity.property.slug}`}
                      className="mt-1 inline-block font-label-sm text-label-sm text-primary hover:text-on-primary-container"
                    >
                      {opportunity.property.title}
                    </Link>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-headline-md text-headline-md text-on-surface">
            Tareas
          </h2>
          {contact.tasks.length === 0 ? (
            <p className="border border-dashed border-outline-variant rounded-lg p-6 text-secondary">
              Sin tareas registradas.
            </p>
          ) : (
            <div className="border border-outline-variant rounded-lg bg-surface-container-lowest divide-y divide-outline-variant">
              {contact.tasks.map((task) => (
                <article
                  key={task.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <h3
                      className={`font-label-md text-label-md ${
                        task.status === "completada"
                          ? "line-through text-secondary"
                          : "text-on-surface"
                      }`}
                    >
                      {task.title}
                    </h3>
                    <p className="mt-0.5 font-label-sm text-label-sm text-secondary">
                      {taskStatusLabel[task.status] ?? task.status}
                      {task.due_at ? ` · ${formatDate(task.due_at)}` : ""}
                      {task.assignee ? ` · ${task.assignee.full_name}` : ""}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-headline-md text-headline-md text-on-surface">
            Consentimientos
          </h2>
          {contact.consents.length === 0 ? (
            <p className="border border-dashed border-outline-variant rounded-lg p-6 text-secondary">
              Sin consentimientos registrados. Hace falta uno vigente para
              enviar plantillas fuera de la ventana de 24 horas.
            </p>
          ) : (
            <div className="border border-outline-variant rounded-lg bg-surface-container-lowest divide-y divide-outline-variant">
              {contact.consents.map((consent) => (
                <article key={consent.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-label-md text-label-md text-on-surface">
                      {consentCategoryLabel[consent.category] ?? consent.category}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-label-sm text-label-sm ${
                        consent.granted && !consent.revoked_at
                          ? "bg-primary-container text-on-primary-container"
                          : "bg-error-container text-on-error-container"
                      }`}
                    >
                      {consent.granted && !consent.revoked_at
                        ? "Vigente"
                        : "Revocado"}
                    </span>
                  </div>
                  <p className="mt-1 font-label-sm text-label-sm text-secondary">
                    {consent.source} · {formatDate(consent.recorded_at)}
                  </p>
                  <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
                    {consent.notice_text}
                  </p>
                </article>
              ))}
            </div>
          )}
          <ContactConsentActions contactId={contact.id} />
        </section>
      </div>
    </>
  );
}
