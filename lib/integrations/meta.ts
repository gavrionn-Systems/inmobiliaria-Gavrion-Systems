import "server-only";
import { createHash } from "node:crypto";

type JsonRecord = Record<string, unknown>;

export type MetaChannel = "whatsapp" | "instagram" | "messenger";

export interface MetaInboundMessage {
  id: string;
  from: string;
  phoneNumberId: string | null;
  contactName: string;
  channel: MetaChannel;
  type: string;
  body: string | null;
  mediaId: string | null;
  timestamp: string | null;
}

export interface MetaMessageStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface MetaTemplateStatusUpdate {
  name: string;
  language: string | null;
  event: string;
  reason: string | null;
}

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.map(record).filter((item): item is JsonRecord => item !== null)
    : [];
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function messageBody(message: JsonRecord): string | null {
  const type = text(message.type);
  if (type === "text") return text(record(message.text)?.body);
  if (type === "button") return text(record(message.button)?.text);
  if (type === "interactive") {
    const interactive = record(message.interactive);
    return (
      text(record(interactive?.button_reply)?.title) ??
      text(record(interactive?.list_reply)?.title)
    );
  }
  return text(record(message[type ?? ""])?.caption);
}

function mediaId(message: JsonRecord): string | null {
  const type = text(message.type);
  return type ? text(record(message[type])?.id) : null;
}

const TEMPLATE_EVENTS = new Set([
  "APPROVED",
  "REJECTED",
  "PAUSED",
  "DISABLED",
  "PENDING",
  "FLAGGED",
  "IN_APPEAL",
  "REINSTATED",
  "PENDING_DELETION",
]);

/** Messenger e Instagram comparten el formato `messaging[]`:
 *  `{ sender: {id}, message: { mid, text, attachments } }` con timestamp en ms. */
function messagingMessages(
  value: JsonRecord,
  channel: MetaChannel
): MetaInboundMessage[] {
  const messages: MetaInboundMessage[] = [];
  for (const item of records(value?.messaging)) {
    const message = record(item?.message);
    if (!message || message.is_echo === true) continue;
    const from = text(record(item?.sender)?.id);
    const id = text(message.mid);
    if (!from || !id) continue;

    const attachments = records(message.attachments);
    const attachmentType = text(attachments[0]?.type);
    const type = attachmentType ?? (text(message.text) ? "text" : "unknown");
    messages.push({
      id,
      from,
      phoneNumberId: text(record(item?.recipient)?.id),
      contactName: "",
      channel,
      type,
      body:
        text(message.text) ??
        text(record(attachments[0]?.payload)?.caption) ??
        null,
      mediaId: null,
      timestamp: text(item.timestamp),
    });
  }
  return messages;
}

export function parseMetaWebhook(payload: unknown): {
  messages: MetaInboundMessage[];
  statuses: MetaMessageStatus[];
  templateUpdates: MetaTemplateStatusUpdate[];
} {
  const root = record(payload);
  const messages: MetaInboundMessage[] = [];
  const statuses: MetaMessageStatus[] = [];
  const templateUpdates: MetaTemplateStatusUpdate[] = [];

  for (const entry of records(root?.entry)) {
    for (const change of records(entry.changes)) {
      const value = record(change.value);
      const field = text(change.field);
      if (
        field === "message_template_status_update" ||
        text(value?.message_template_name)
      ) {
        const event = text(value?.event)?.toUpperCase();
        const name =
          text(value?.message_template_name) ?? text(value?.name);
        if (event && name && TEMPLATE_EVENTS.has(event)) {
          templateUpdates.push({
            name,
            language:
              text(value?.message_template_language) ??
              text(value?.language),
            event,
            reason: text(value?.reason),
          });
        }
      }

      const metadata = record(value?.metadata);
      const phoneNumberId = text(metadata?.phone_number_id);

      // Messenger e Instagram: campo "messages" (Pages) o "instagram", con
      // arreglo messaging[] en lugar del formato Cloud API de WhatsApp.
      if (
        (field === "messages" || field === "instagram") &&
        Array.isArray(value?.messaging)
      ) {
        const channel: MetaChannel =
          field === "instagram" ? "instagram" : "messenger";
        messages.push(...messagingMessages(value, channel));
        continue;
      }

      const contactsByWaId = new Map(
        records(value?.contacts).map((contact) => [
          text(contact.wa_id),
          text(record(contact.profile)?.name),
        ])
      );

      for (const message of records(value?.messages)) {
        const id = text(message.id);
        const from = text(message.from);
        if (!id || !from) continue;
        messages.push({
          id,
          from,
          phoneNumberId,
          contactName: contactsByWaId.get(from) ?? from,
          channel: "whatsapp",
          type: text(message.type) ?? "unknown",
          body: messageBody(message),
          mediaId: mediaId(message),
          timestamp: text(message.timestamp),
        });
      }

      for (const item of records(value?.statuses)) {
        const id = text(item.id);
        const status = text(item.status);
        if (
          !id ||
          (status !== "sent" &&
            status !== "delivered" &&
            status !== "read" &&
            status !== "failed")
        ) {
          continue;
        }
        const firstError = records(item.errors)[0];
        statuses.push({
          id,
          status,
          timestamp: text(item.timestamp),
          errorCode:
            typeof firstError?.code === "number"
              ? String(firstError.code)
              : text(firstError?.code),
          errorMessage:
            text(firstError?.title) ?? text(firstError?.message) ?? null,
        });
      }
    }
  }

  return { messages, statuses, templateUpdates };
}

export function metaEventId(rawBody: string): string {
  // El mismo wamid aparece en eventos sent/delivered/read distintos. El hash
  // deduplica reintentos idénticos sin descartar transiciones posteriores.
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}
