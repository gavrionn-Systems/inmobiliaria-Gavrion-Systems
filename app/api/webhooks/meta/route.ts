import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import {
  metaEventId,
  parseMetaWebhook,
  type MetaInboundMessage,
  type MetaMessageStatus,
  type MetaTemplateStatusUpdate,
} from "@/lib/integrations/meta";
import { verifySignature } from "@/lib/integrations/signatures";
import { ingestPendingWhatsappMedia } from "@/lib/integrations/whatsapp-media";

const MAX_BODY_BYTES = 1024 * 1024;
const UNSUPPORTED_MEDIA_REPLIES: Partial<Record<string, string>> = {
  audio: "Gracias por tu audio. Aún no puedo escucharlo; envíame tu consulta por texto y con gusto te ayudo.",
  image: "Gracias por la imagen. Aún no puedo analizar imágenes; cuéntame por texto qué necesitas y te ayudo.",
};

function eventDate(timestamp: string | null): Date {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || seconds <= 0) return new Date();
  // Messenger/Instagram envían milisegundos; WhatsApp, segundos.
  return new Date(seconds > 1e12 ? seconds : seconds * 1000);
}

const CHANNEL_FALLBACK_NAME: Record<string, string> = {
  instagram: "Usuario de Instagram",
  messenger: "Usuario de Messenger",
};

async function storeInboundMessage(
  message: MetaInboundMessage
): Promise<{ conversationId: string; inserted: boolean }> {
  const supabase = createAdminClient();
  const messageAt = eventDate(message.timestamp);
  const serviceWindow = new Date(messageAt.getTime() + 24 * 60 * 60 * 1000);
  const isWhatsapp = message.channel === "whatsapp";

  // Messenger e Instagram no exponen teléfono: se usa un id sintético como
  // wa_id para cumplir el CHECK de contacts y deduplicar por persona.
  const contactId = isWhatsapp
    ? message.from
    : `${message.channel}:${message.from}`;

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .upsert(
      {
        wa_id: contactId,
        phone: isWhatsapp ? message.from : null,
        full_name:
          message.contactName ||
          CHANNEL_FALLBACK_NAME[message.channel] ||
          contactId,
        source: message.channel,
      },
      { onConflict: "wa_id" }
    )
    .select("id")
    .single();
  if (contactError) throw contactError;

  const { data: existingConversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("contact_id", contact.id)
    .eq("channel", message.channel)
    .neq("status", "cerrada")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let conversationId = existingConversation?.id;
  if (!conversationId) {
    const { data: conversation, error } = await supabase
      .from("conversations")
      .insert({
        contact_id: contact.id,
        channel: message.channel,
        phone_number_id: message.phoneNumberId,
        last_message_at: messageAt.toISOString(),
        customer_service_window_expires_at: serviceWindow.toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    conversationId = conversation.id;
  } else {
    const { error } = await supabase
      .from("conversations")
      .update({
        status: "abierta",
        phone_number_id: message.phoneNumberId,
        last_message_at: messageAt.toISOString(),
        customer_service_window_expires_at: serviceWindow.toISOString(),
      })
      .eq("id", conversationId);
    if (error) throw error;
  }

  const { data: inboundMessage, error: messageError } = await supabase
    .from("messages")
    .upsert(
    {
      conversation_id: conversationId,
      direction: "inbound",
      message_type: message.type,
      body: message.body,
      media_url: message.mediaId ? `meta-media:${message.mediaId}` : null,
      meta_message_id: message.id,
      status: "delivered",
      sent_at: messageAt.toISOString(),
    },
    { onConflict: "meta_message_id", ignoreDuplicates: true }
    )
    .select("id")
    .maybeSingle();
  if (messageError) throw messageError;
  return { conversationId, inserted: Boolean(inboundMessage) };
}

async function queueUnsupportedMediaReply(
  conversationId: string,
  message: MetaInboundMessage
) {
  const body = UNSUPPORTED_MEDIA_REPLIES[message.type];
  if (!body) return;

  const supabase = createAdminClient();
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    direction: "outbound",
    message_type: "text",
    body,
    reply_to_meta_message_id: message.id,
    status: "pending",
  });
  if (error) throw error;
}

const TEMPLATE_STATUS_MAP: Record<string, string> = {
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  PAUSED: "PAUSED",
  DISABLED: "DISABLED",
  PENDING: "PENDING",
  REINSTATED: "APPROVED",
  FLAGGED: "PAUSED",
  IN_APPEAL: "PAUSED",
  PENDING_DELETION: "DISABLED",
};

async function storeTemplateStatus(update: MetaTemplateStatusUpdate) {
  const status = TEMPLATE_STATUS_MAP[update.event];
  if (!status) return;
  const supabase = createAdminClient();
  let query = supabase
    .from("whatsapp_templates")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("name", update.name);
  if (update.language) query = query.eq("language", update.language);
  const { error } = await query;
  if (error) throw error;
}

async function storeMessageStatus(item: MetaMessageStatus) {
  const supabase = createAdminClient();
  const at = eventDate(item.timestamp).toISOString();
  const timestamps =
    item.status === "read"
      ? { read_at: at, delivered_at: at }
      : item.status === "delivered"
        ? { delivered_at: at }
        : item.status === "sent"
          ? { sent_at: at }
          : {};

  const { error } = await supabase
    .from("messages")
    .update({
      status: item.status,
      error_code: item.errorCode,
      error_message: item.errorMessage,
      ...timestamps,
    })
    .eq("meta_message_id", item.id);
  if (error) throw error;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (
    mode !== "subscribe" ||
    !challenge ||
    !process.env.META_VERIFY_TOKEN ||
    token !== process.env.META_VERIFY_TOKEN
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  return new Response(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`meta-webhook:${ip}`, 600, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const appSecret = process.env.META_APP_SECRET ?? "";
  if (
    !verifySignature(
      rawBody,
      request.headers.get("x-hub-signature-256"),
      appSecret
    )
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseMetaWebhook(payload);
  const externalEventId = metaEventId(rawBody);
  const supabase = createAdminClient();
  const { data: claim, error: claimError } = await supabase
    .rpc("claim_webhook_event", {
      event_provider: "meta",
      event_external_id: externalEventId,
      event_payload: payload,
    })
    .single();
  if (claimError || !claim) {
    console.error("[meta-webhook] Could not claim event:", claimError);
    return NextResponse.json({ error: "Could not persist event" }, { status: 500 });
  }
  const claimedEvent = claim as {
    event_id: string;
    event_status: string;
    claimed: boolean;
  };
  if (!claimedEvent.claimed) {
    if (claimedEvent.event_status === "processing") {
      return NextResponse.json(
        { error: "Event is still processing" },
        { status: 503, headers: { "Retry-After": "600" } }
      );
    }
    return NextResponse.json({ received: true, duplicate: true });
  }
  const webhookEventId = claimedEvent.event_id;

  try {
    for (const message of parsed.messages) {
      const stored = await storeInboundMessage(message);
      // La auto-respuesta y la descarga de media son exclusivas de WhatsApp;
      // Instagram y Messenger son de solo recepción por ahora.
      if (
        message.channel === "whatsapp" &&
        stored.inserted
      ) {
        await queueUnsupportedMediaReply(stored.conversationId, message);
      }
    }
    for (const status of parsed.statuses) {
      await storeMessageStatus(status);
    }
    for (const update of parsed.templateUpdates) {
      await storeTemplateStatus(update);
    }
    if (
      parsed.messages.some(
        (message) =>
          message.channel === "whatsapp" && message.mediaId
      )
    ) {
      await ingestPendingWhatsappMedia();
    }

    const { error: outboxError } = await supabase.from("outbox_events").upsert(
      {
        event_type: "meta.webhook.received",
        aggregate_type: "webhook_event",
        aggregate_id: webhookEventId,
        payload: { webhook_event_id: webhookEventId, ...parsed },
      },
      {
        onConflict: "event_type,aggregate_id",
        ignoreDuplicates: true,
      }
    );
    if (outboxError) throw outboxError;

    await supabase
      .from("webhook_events")
      .update({ status: "sent", processed_at: new Date().toISOString() })
      .eq("id", webhookEventId);
  } catch (error) {
    console.error("[meta-webhook] Processing failed:", error);
    await supabase
      .from("webhook_events")
      .update({
        status: "failed",
        error_message: "No se pudo procesar el evento.",
      })
      .eq("id", webhookEventId);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
