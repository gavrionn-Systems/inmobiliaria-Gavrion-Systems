import Link from "next/link";
import { notFound } from "next/navigation";
import ConversationComposer from "@/components/admin/crm/ConversationComposer";
import ConversationControls from "@/components/admin/crm/ConversationControls";
import ConversationLiveRefresh from "@/components/admin/crm/ConversationLiveRefresh";
import { getProfiles } from "@/lib/admin-queries";
import { getSession } from "@/lib/auth";
import { getCrmConversation } from "@/lib/crm-queries";
import { formatDate, leadSourceLabel, channelLabel } from "@/lib/format";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const [conversation, session] = await Promise.all([
    getCrmConversation(conversationId),
    getSession(),
  ]);
  if (!conversation?.contact) notFound();

  const profiles =
    session?.user.role === "admin"
      ? (await getProfiles())
          .filter((profile) => profile.is_active)
          .map((profile) => ({
            id: profile.id,
            full_name: profile.full_name,
            role: profile.role,
          }))
      : [];
  const windowOpen = conversation.window_open;

  return (
    <>
      <div className="mb-5">
        <Link
          href="/admin/crm/inbox"
          className="inline-flex items-center gap-1 font-label-md text-label-md text-primary hover:text-on-primary-container"
        >
          <span className="material-symbols-outlined text-xl" aria-hidden="true">
            arrow_back
          </span>
          Volver al inbox
        </Link>
      </div>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
              {conversation.contact.full_name}
            </h1>
            <span className="rounded-full bg-surface-container-high px-2 py-1 font-label-sm text-label-sm text-on-surface-variant">
              {channelLabel(conversation.channel)}
            </span>
          </div>
          <p className="mt-1 font-body-md text-body-md text-secondary">
            {conversation.contact.phone ??
              conversation.contact.email ??
              "Sin dato de contacto"}
            {" · "}
            <Link
              href={`/admin/crm/contactos/${conversation.contact.id}`}
              className="text-primary hover:text-on-primary-container"
            >
              Ver ficha
            </Link>
          </p>
          {conversation.channel === "whatsapp" && (
            <p
              className={`mt-2 font-label-sm text-label-sm ${
                windowOpen ? "text-primary" : "text-on-error-container"
              }`}
            >
              {windowOpen
                ? `Ventana de atención abierta hasta ${formatDate(
                    conversation.customer_service_window_expires_at!
                  )}`
                : "Ventana de 24 horas cerrada"}
            </p>
          )}
        </div>
        <ConversationControls
          conversationId={conversation.id}
          contactId={conversation.contact.id}
          status={conversation.status}
          botMode={conversation.bot_mode}
          assignedTo={conversation.assigned_to}
          profiles={profiles}
          canAssign={session?.user.role === "admin"}
          canClaim={
            session?.user.role === "agente" && !conversation.assigned_to
          }
          canTakeover={session?.user.role === "admin"}
          currentUserId={session?.user.id ?? ""}
        />
      </header>

      <section
        aria-label="Origen del lead"
        className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 font-body-sm text-body-sm"
      >
        <p className="font-label-sm text-label-sm text-secondary">
          Origen del lead
        </p>
        <p className="flex items-center gap-2 text-on-surface">
          <span className="material-symbols-outlined text-lg text-primary" aria-hidden="true">
            {conversation.channel === "whatsapp" ? "chat" : "language"}
          </span>
          {leadSourceLabel(conversation.contact.source)}
        </p>
        <p className="font-label-sm text-label-sm text-secondary">
          Canal de la conversación:{" "}
          <span className="text-on-surface">
            {channelLabel(conversation.channel)}
          </span>
        </p>
      </section>

      <div className="border border-outline-variant rounded-lg overflow-hidden bg-surface-container-low">
        <div
          className="min-h-80 max-h-[58vh] overflow-y-auto px-4 py-5 sm:px-6"
          aria-label="Historial de mensajes"
        >
          {conversation.messages.length === 0 ? (
            <p className="py-12 text-center font-body-md text-body-md text-secondary">
              Todavía no hay mensajes en esta conversación.
            </p>
          ) : (
            <ol className="space-y-3">
              {conversation.messages.map((message) => {
                const outbound = message.direction === "outbound";
                return (
                  <li
                    key={message.id}
                    className={`flex ${outbound ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[70%] rounded-lg px-4 py-3 ${
                        outbound
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container-lowest text-on-surface border border-outline-variant"
                      }`}
                    >
                      <p className="font-body-md text-body-md whitespace-pre-wrap break-words">
                        {message.body ?? `[${message.message_type}]`}
                      </p>
                      {message.media_url &&
                        (message.media_url.startsWith("http") ? (
                          message.message_type === "image" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={message.media_url}
                              alt={message.body ?? "Imagen de WhatsApp"}
                              className="mt-2 max-h-64 w-auto rounded"
                            />
                          ) : (
                            <a
                              href={message.media_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`mt-1 inline-flex items-center gap-1 font-label-sm text-label-sm underline ${
                                outbound ? "text-primary-fixed" : "text-primary"
                              }`}
                            >
                              <span
                                className="material-symbols-outlined text-base"
                                aria-hidden="true"
                              >
                                attach_file
                              </span>
                              Adjunto
                            </a>
                          )
                        ) : (
                          <span
                            className={`mt-1 inline-flex items-center gap-1 font-label-sm text-label-sm ${
                              outbound ? "text-primary-fixed" : "text-secondary"
                            }`}
                            title={message.media_url}
                          >
                            <span
                              className="material-symbols-outlined text-base"
                              aria-hidden="true"
                            >
                              attach_file
                            </span>
                            Adjunto de WhatsApp ({message.message_type})
                          </span>
                        ))}
                      <div
                        className={`mt-1 flex items-center justify-end gap-2 font-label-sm text-label-sm ${
                          outbound ? "text-primary-fixed" : "text-secondary"
                        }`}
                      >
                        <span>{formatDate(message.sent_at ?? message.created_at)}</span>
                        {outbound && <span>{message.status}</span>}
                      </div>
                      {message.error_message && (
                        <p className="mt-2 font-label-sm text-label-sm text-error-container">
                          {message.error_message}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        <ConversationComposer
          conversationId={conversation.id}
          channel={
            conversation.channel === "instagram"
              ? "instagram"
              : conversation.channel === "messenger"
                ? "messenger"
                : conversation.channel === "whatsapp"
                  ? "whatsapp"
                  : "web"
          }
          windowOpen={windowOpen}
          templates={conversation.templates}
        />
      </div>
      <ConversationLiveRefresh conversationId={conversation.id} />
    </>
  );
}
