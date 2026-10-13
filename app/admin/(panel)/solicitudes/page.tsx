import Link from "next/link";
import InquiriesList from "@/components/admin/InquiriesList";
import { getInquiries } from "@/lib/admin-queries";
import { getCrmInbox } from "@/lib/crm-queries";

export const metadata = {
  title: "Solicitudes · Admin",
};

export default async function AdminInquiriesPage() {
  const [inquiries, chatConversations] = await Promise.all([
    getInquiries(),
    getCrmInbox({ channel: "web" }),
  ]);
  const rows = inquiries.map((inq) => ({
    ...inq,
    properties: Array.isArray(inq.properties)
      ? (inq.properties[0] ?? null)
      : ((inq.properties as { title: string; slug: string } | null) ?? null),
  }));

  return (
    <>
      <header className="mb-8">
        <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-1">
          Solicitudes
        </h1>
        <p className="font-body-md text-body-md text-secondary">
          Solicitudes recibidas desde el chatbox del sitio. Las conversaciones
          se atienden aquí y también quedan disponibles en el Inbox del CRM,
          donde puede tomar el control de la IA o asignarlas a un responsable.
        </p>
      </header>

      <section className="mb-8 rounded-lg border border-outline-variant bg-surface-container-low p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">Conversaciones del chatbox</h2>
            <p className="mt-1 text-sm text-secondary">Mensajes de visitantes que llegaron desde el sitio público.</p>
          </div>
          <Link href="/admin/crm/inbox?canal=web" className="rounded border border-outline-variant px-3 py-2 text-sm text-primary hover:bg-surface-container-high">Abrir Inbox completo</Link>
        </div>
        {chatConversations.length === 0 ? (
          <div className="rounded border border-dashed border-outline-variant px-5 py-10 text-center text-sm text-secondary">Todavía no hay conversaciones del chatbox.</div>
        ) : (
          <div className="divide-y divide-outline-variant rounded border border-outline-variant bg-surface-container-lowest">
            {chatConversations.map((conversation) => (
              <Link key={conversation.id} href={`/admin/crm/inbox/${conversation.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 hover:bg-surface-container-low">
                <div><p className="font-semibold text-on-surface">{conversation.contact?.full_name ?? "Visitante web"}</p><p className="mt-1 max-w-2xl truncate text-sm text-secondary">{conversation.latest_message?.body ?? "Sin mensajes"}</p></div>
                <div className="flex items-center gap-2 text-xs text-secondary"><span className="rounded-full bg-primary-container px-2 py-1 text-on-primary-container">{conversation.bot_mode === "manual" ? "Atención humana" : "IA activa"}</span><span>{conversation.status}</span></div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-headline-md text-headline-md text-on-surface">Formularios tradicionales</h2>
        <p className="mb-4 text-sm text-secondary">Registros anteriores del formulario de contacto, conservados para no perder información histórica.</p>
        <InquiriesList rows={rows} />
      </section>
    </>
  );
}
