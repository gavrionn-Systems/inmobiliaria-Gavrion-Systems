import "server-only";
import { authorize } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { metaWhatsappToken } from "@/lib/integrations/meta-token";
import { signCrmMediaUrls } from "@/lib/integrations/whatsapp-media";

type LatestMessage = {
  conversation_id: string;
  body: string | null;
  message_type: string;
  direction: string;
  created_at: string;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

async function crmClient() {
  const session = await authorize();
  if (!session) throw new Error("No autorizado");
  // El panel usa una sesión propia firmada por la aplicación, no una sesión
  // persistida de Supabase Auth. Tras autorizar el rol en el servidor, el
  // cliente de servicio permite consultar el CRM sin que RLS lo vea como anon.
  return { session, supabase: createAdminClient() };
}

export interface CrmInboxFilters {
  channel?: string;
  status?: string;
  assignee?: string;
  q?: string;
}

export interface CrmTaskFilters {
  status?: string;
  assignee?: string;
}

export async function getCrmInbox(filters: CrmInboxFilters = {}) {
  const { supabase } = await crmClient();
  let query = supabase
    .from("conversations")
    .select(
      "id, channel, status, bot_mode, assigned_to, customer_service_window_expires_at, last_message_at, contacts!inner(id, full_name, phone, email, wa_id, assigned_to), profiles:assigned_to(full_name)"
    );

  if (
    filters.channel === "whatsapp" ||
    filters.channel === "web" ||
    filters.channel === "instagram" ||
    filters.channel === "messenger"
  ) {
    query = query.eq("channel", filters.channel);
  }
  if (
    filters.status === "abierta" ||
    filters.status === "pendiente" ||
    filters.status === "cerrada"
  ) {
    query = query.eq("status", filters.status);
  }
  if (filters.assignee === "none") {
    query = query.is("assigned_to", null);
  } else if (filters.assignee && /^[0-9a-f-]{36}$/i.test(filters.assignee)) {
    query = query.eq("assigned_to", filters.assignee);
  }
  if (filters.q) {
    // Se eliminan los caracteres reservados de PostgREST y de LIKE para que
    // la búsqueda sea literal.
    const term = filters.q.replace(/[,()%_\\]/g, " ").trim().slice(0, 80);
    if (term) {
      query = query.or(
        `full_name.ilike.%${term}%,phone.ilike.%${term}%`,
        { referencedTable: "contacts" }
      );
    }
  }

  const { data, error } = await query
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) throw error;

  const ids = (data ?? []).map((row) => row.id);
  const { data: latestMessages } = ids.length
    ? await supabase
        .from("messages")
        .select("conversation_id, body, message_type, direction, created_at")
        .in("conversation_id", ids)
        .order("created_at", { ascending: false })
    : { data: [] };

  const latestByConversation = new Map<string, LatestMessage>();
  for (const message of (latestMessages ?? []) as LatestMessage[]) {
    if (!latestByConversation.has(message.conversation_id)) {
      latestByConversation.set(message.conversation_id, message);
    }
  }

  return (data ?? []).map((conversation) => ({
    ...conversation,
    contact: one(conversation.contacts),
    assignee: one(conversation.profiles),
    latest_message: latestByConversation.get(conversation.id) ?? null,
  }));
}

export async function getCrmConversation(id: string) {
  const { supabase } = await crmClient();
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select(
      "id, channel, status, bot_mode, assigned_to, phone_number_id, customer_service_window_expires_at, last_message_at, contacts(id, full_name, phone, email, wa_id, source, status, notes), profiles:assigned_to(full_name)"
    )
    .eq("id", id)
    .single();
  if (error) return null;

  const { data: messages, error: messageError } = await supabase
    .from("messages")
    .select(
      "id, direction, message_type, body, media_url, status, template_name, template_params, error_message, sent_at, created_at"
    )
    .eq("conversation_id", id)
    .order("created_at");
  if (messageError) throw messageError;

  const { data: templates } = await supabase
    .from("whatsapp_templates")
    .select("name, language, category, body_preview, components")
    .eq("status", "APPROVED")
    .order("name");

  const signedMessages = await signCrmMediaUrls(supabase, messages ?? []);

  return {
    ...conversation,
    contact: one(conversation.contacts),
    assignee: one(conversation.profiles),
    messages: signedMessages,
    templates: templates ?? [],
    window_open:
      conversation.customer_service_window_expires_at !== null &&
      new Date(conversation.customer_service_window_expires_at).getTime() >
        Date.now(),
  };
}

export async function getCrmContacts() {
  const { supabase } = await crmClient();
  const { data, error } = await supabase
    .from("contacts")
    .select(
      "id, full_name, email, phone, wa_id, source, status, assigned_to, notes, created_at, profiles:assigned_to(full_name)"
    )
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((contact) => ({
    ...contact,
    assignee: one(contact.profiles),
  }));
}

/** Ficha completa de un contacto con sus relaciones. Devuelve null si el
 *  usuario no tiene acceso (RLS) o el contacto no existe. */
export async function getCrmContact(id: string) {
  const { supabase } = await crmClient();
  const { data: contact, error } = await supabase
    .from("contacts")
    .select(
      "id, full_name, email, phone, wa_id, source, status, notes, assigned_to, created_at, updated_at, profiles:assigned_to(id, full_name)"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!contact) return null;

  const [
    { data: conversations },
    { data: opportunities },
    { data: tasks },
    { data: consents },
    { data: suppression },
  ] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, channel, status, last_message_at, created_at")
      .eq("contact_id", id)
      .order("last_message_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("opportunities")
      .select(
        "id, title, value, currency, status, expected_close_at, pipeline_stages(name), properties(id, title, slug)"
      )
      .eq("contact_id", id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("id, title, status, due_at, profiles:assigned_to(full_name)")
      .eq("contact_id", id)
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("consents")
      .select("id, category, granted, revoked_at, source, notice_text, recorded_at")
      .eq("contact_id", id)
      .order("recorded_at", { ascending: false }),
    supabase
      .from("suppression_list")
      .select("id, reason, suppressed_at")
      .eq("contact_id", id)
      .maybeSingle(),
  ]);

  return {
    ...contact,
    assignee: one(contact.profiles),
    conversations: conversations ?? [],
    opportunities: (opportunities ?? []).map((item) => ({
      ...item,
      stage: one(item.pipeline_stages),
      property: one(item.properties),
    })),
    tasks: (tasks ?? []).map((task) => ({
      ...task,
      assignee: one(task.profiles),
    })),
    consents: consents ?? [],
    suppression: suppression ?? null,
  };
}

export async function getCrmPipeline(includeClosed = false) {
  const { supabase } = await crmClient();
  let opportunitiesQuery = supabase
    .from("opportunities")
    .select(
      "id, title, value, currency, status, stage_id, expected_close_at, property_id, contacts(id, full_name), properties(id, title, slug), profiles:assigned_to(full_name)"
    )
    .order("updated_at", { ascending: false });
  if (!includeClosed) {
    opportunitiesQuery = opportunitiesQuery.eq("status", "abierta");
  }

  const [{ data: stages, error: stageError }, { data: opportunities, error }] =
    await Promise.all([
      supabase
        .from("pipeline_stages")
        .select("id, name, position, is_closed")
        .order("position"),
      opportunitiesQuery,
    ]);
  if (stageError) throw stageError;
  if (error) throw error;
  return {
    stages: stages ?? [],
    opportunities: (opportunities ?? []).map((item) => ({
      ...item,
      contact: one(item.contacts),
      property: one(item.properties),
      assignee: one(item.profiles),
    })),
  };
}

export async function getCrmTasks(filters: CrmTaskFilters = {}) {
  const { supabase } = await crmClient();
  let query = supabase
    .from("tasks")
    .select(
      "id, title, description, due_at, status, assigned_to, contacts(id, full_name), opportunities(id, title), profiles:assigned_to(full_name)"
    )
    .order("status")
    .order("due_at", { ascending: true, nullsFirst: false });

  if (
    filters.status === "pendiente" ||
    filters.status === "completada" ||
    filters.status === "cancelada"
  ) {
    query = query.eq("status", filters.status);
  }
  if (filters.assignee && /^[0-9a-f-]{36}$/i.test(filters.assignee)) {
    query = query.eq("assigned_to", filters.assignee);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((task) => ({
    ...task,
    contact: one(task.contacts),
    opportunity: one(task.opportunities),
    assignee: one(task.profiles),
    is_overdue:
      task.status === "pendiente" &&
      task.due_at !== null &&
      new Date(task.due_at).getTime() < Date.now(),
  }));
}

export async function getCrmCreationOptions() {
  const { supabase } = await crmClient();
  const [
    { data: contacts },
    { data: stages },
    { data: properties },
    { data: opportunities },
  ] = await Promise.all([
    supabase.from("contacts").select("id, full_name").order("full_name"),
    supabase
      .from("pipeline_stages")
      .select("id, name, position")
      .order("position"),
    supabase
      .from("properties")
      .select("id, title")
      .eq("status", "publicada")
      .order("title"),
    supabase
      .from("opportunities")
      .select("id, title")
      .eq("status", "abierta")
      .order("title"),
  ]);
  return {
    contacts: contacts ?? [],
    stages: stages ?? [],
    properties: properties ?? [],
    opportunities: opportunities ?? [],
  };
}

export async function getCrmConfiguration() {
  const { session, supabase } = await crmClient();
  if (session.user.role !== "admin") return null;

  const [{ data: templates }] = await Promise.all([
    supabase
      .from("whatsapp_templates")
      .select("id, name, language, category, status, body_preview, updated_at")
      .order("name"),
  ]);

  return {
    templates: templates ?? [],
    eventCounts: {},
    integration: {
      metaWebhook: Boolean(
        process.env.META_VERIFY_TOKEN && process.env.META_APP_SECRET
      ),
      scheduler: Boolean(process.env.CRON_SECRET),
      templateSync: Boolean(metaWhatsappToken() && process.env.META_WABA_ID),
    },
  };
}
