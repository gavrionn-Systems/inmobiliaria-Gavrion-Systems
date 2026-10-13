import { NextResponse } from "next/server";
import { createCompanyReply } from "@/lib/ai/company-assistant";
import { getChatboxSettings, widgetKeyIsValid } from "@/lib/chatbox";
import { rateLimit } from "@/lib/rate-limit";
import { getSiteSettings } from "@/lib/site-settings";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function jsonError(message: string, status: number, origin: string | null) {
  return NextResponse.json({ error: message }, { status, headers: cors(origin) });
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request.headers.get("origin")) });
}

async function authorizeWidget(key: string) {
  const settings = await getChatboxSettings();
  if (!settings.enabled || !widgetKeyIsValid(key, settings)) return null;
  return settings;
}

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";
  const visitorId = url.searchParams.get("visitorId")?.trim().slice(0, 100) ?? "";
  const conversationId = url.searchParams.get("conversationId")?.trim() ?? "";
  if (!key || !visitorId || !conversationId) return jsonError("Solicitud incompleta.", 400, origin);

  if (!(await authorizeWidget(key))) return jsonError("Widget no disponible.", 404, origin);

  const supabase = createAdminClient();
  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("source", "web")
    .eq("web_visitor_id", visitorId)
    .maybeSingle();
  if (!contact) return jsonError("Conversación no encontrada.", 404, origin);

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("contact_id", contact.id)
    .eq("channel", "web")
    .maybeSingle();
  if (!conversation) return jsonError("Conversación no encontrada.", 404, origin);

  const { data, error } = await supabase
    .from("messages")
    .select("id, direction, body, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) return jsonError("No se pudo cargar el chat.", 500, origin);
  return NextResponse.json({ messages: data ?? [] }, { headers: cors(origin) });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return jsonError("JSON inválido.", 400, origin);
  }

  const key = String(input.key ?? "").trim();
  const visitorId = String(input.visitorId ?? "").trim().slice(0, 100);
  const name = String(input.name ?? "Visitante web").trim().slice(0, 100) || "Visitante web";
  const email = String(input.email ?? "").trim().toLowerCase().slice(0, 254);
  const text = String(input.text ?? "").trim().slice(0, 2000);
  if (!key || !visitorId || !text) return jsonError("Completa el mensaje.", 400, origin);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError("Correo inválido.", 400, origin);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`chatbox:${key}:${ip}`, 30, 10 * 60 * 1000)) {
    return jsonError("Has enviado demasiados mensajes. Intenta de nuevo en unos minutos.", 429, origin);
  }

  const settings = await authorizeWidget(key);
  if (!settings) return jsonError("Widget no disponible.", 404, origin);

  const supabase = createAdminClient();
  let { data: contact } = await supabase
    .from("contacts")
    .select("id, full_name, email")
    .eq("source", "web")
    .eq("web_visitor_id", visitorId)
    .maybeSingle();

  if (!contact) {
    const created = await supabase
      .from("contacts")
      .insert({
        full_name: name,
        email: email || null,
        source: "web",
        status: "lead",
        web_visitor_id: visitorId,
      })
      .select("id, full_name, email")
      .single();
    if (created.error || !created.data) return jsonError("No se pudo registrar el contacto.", 500, origin);
    contact = created.data;
  } else if (name !== "Visitante web" || email) {
    const updated = await supabase
      .from("contacts")
      .update({ full_name: name, ...(email ? { email } : {}) })
      .eq("id", contact.id)
      .select("id, full_name, email")
      .single();
    if (!updated.error && updated.data) contact = updated.data;
  }

  let { data: conversation } = await supabase
    .from("conversations")
    .select("id, bot_mode")
    .eq("contact_id", contact.id)
    .eq("channel", "web")
    .maybeSingle();
  if (!conversation) {
    const created = await supabase
      .from("conversations")
      .insert({
        contact_id: contact.id,
        channel: "web",
        status: "abierta",
        bot_mode: "ia",
        last_message_at: new Date().toISOString(),
      })
      .select("id, bot_mode")
      .single();
    if (created.error || !created.data) return jsonError("No se pudo crear la conversación.", 500, origin);
    conversation = created.data;
  } else {
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversation.id);
  }

  const inserted = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      direction: "inbound",
      message_type: "text",
      body: text,
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .select("id, direction, body, created_at")
    .single();
  if (inserted.error || !inserted.data) return jsonError("No se pudo guardar el mensaje.", 500, origin);

  let botMessage: { id: string; direction: string; body: string; created_at: string } | null = null;
  if (settings.assistant_enabled && conversation.bot_mode === "ia") {
    const [{ data: history }, { data: properties }] = await Promise.all([
      supabase
        .from("messages")
        .select("direction, body")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("properties")
        .select("code, title, operation, price, currency, address, bedrooms, bathrooms, construction_area_m2, description")
        .eq("status", "publicada")
        .limit(100),
    ]);
    const inventory = (properties ?? [])
      .map((property) =>
        `${property.code}: ${property.title}; ${property.operation}; ${property.price} ${property.currency}; ${property.address || ""}; ${property.bedrooms ?? "-"} habitaciones; ${property.bathrooms ?? "-"} baños; ${property.construction_area_m2 ?? "-"} m². ${property.description || ""}`,
      )
      .join("\n");
    const knowledge = [settings.knowledge, inventory ? `INVENTARIO PUBLICADO:\n${inventory}` : ""]
      .filter(Boolean)
      .join("\n\n");

    let generated;
    try {
      const site = await getSiteSettings();
      generated = await createCompanyReply({
        company: site.name,
        assistantName: settings.assistant_name,
        instructions: settings.assistant_instructions,
        handoffMessage: settings.handoff_message,
        knowledge,
        history: (history ?? []).reverse(),
        message: text,
        visitorId,
      });
    } catch (error) {
      console.error("[chatbox-ai] No se pudo generar respuesta", error);
      generated = {
        reply: "En este momento no pude procesar tu mensaje. Intenta nuevamente en unos segundos.",
        // Un fallo temporal del proveedor no equivale a una solicitud de
        // atención humana ni debe dejar la conversación en modo manual.
        handoff: false,
        provider: "fallback",
      };
    }

    const botInserted = await supabase
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        direction: "outbound",
        message_type: "text",
        body: generated.reply,
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .select("id, direction, body, created_at")
      .single();
    if (!botInserted.error && botInserted.data) botMessage = botInserted.data;

    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        ...(generated.handoff ? { bot_mode: "manual", status: "pendiente" } : {}),
      })
      .eq("id", conversation.id);
  }

  return NextResponse.json(
    { conversationId: conversation.id, message: inserted.data, botMessage },
    { headers: cors(origin) },
  );
}
