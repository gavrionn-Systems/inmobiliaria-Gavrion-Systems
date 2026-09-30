"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncWhatsappTemplates } from "@/lib/integrations/templates";

export type CrmActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

const uuid = z.uuid();

async function context(adminOnly = false) {
  const session = await authorize(adminOnly ? ["admin"] : ["admin", "agente"]);
  if (!session) return null;
  return {
    session,
    // Las acciones ya están protegidas por authorize/roles. La sesión de la
    // aplicación no crea una cookie de Supabase Auth, por lo que el cliente
    // SSR sería anon y RLS bloquearía incluso a un administrador válido.
    supabase: createAdminClient(),
    userId: session.user.id ?? session.user.email,
  };
}

async function audit(
  supabase: ReturnType<typeof createAdminClient>,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {}
) {
  const { error } = await supabase.from("audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
  if (error) console.error("[crm-audit] No se pudo registrar:", error);
}

function failure(error: unknown, fallback: string): CrmActionResult {
  console.error("[crm-actions]", error);
  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message
      : "";
  if (message.includes("ventana de 24 horas")) {
    return { ok: false, error: "Seleccione una plantilla aprobada para continuar." };
  }
  if (message.includes("consentimiento")) {
    return { ok: false, error: "El contacto no tiene consentimiento vigente." };
  }
  if (message.includes("no recibir mensajes")) {
    return { ok: false, error: "El contacto solicitó no recibir más mensajes." };
  }
  return { ok: false, error: fallback };
}

export async function sendCrmMessage(input: {
  conversationId: string;
  body: string;
  templateName?: string | null;
  templateLanguage?: string | null;
  templateHeader?: string | null;
  templateBodyParams?: string[];
}): Promise<CrmActionResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "No autorizado." };
  const parsed = z
    .object({
      conversationId: uuid,
      body: z.string().trim().min(1).max(4096),
      templateName: z.string().trim().min(1).max(200).nullable().optional(),
      templateLanguage: z.string().trim().min(2).max(10).nullable().optional(),
      templateHeader: z.string().trim().max(200).nullable().optional(),
      templateBodyParams: z.array(z.string().trim().min(1).max(1024)).max(10).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Mensaje no válido." };

  const { data: conversation, error: conversationError } = await ctx.supabase
    .from("conversations")
    .select("id, channel")
    .eq("id", parsed.data.conversationId)
    .single();
  if (conversationError || !conversation) {
    return { ok: false, error: "La conversación no está disponible." };
  }
  // Instagram y Messenger son de solo recepción: no hay envío implementado.
  if (
    conversation.channel === "instagram" ||
    conversation.channel === "messenger"
  ) {
    return {
      ok: false,
      error:
        "El envío por este canal no está disponible. Contacte a la persona por WhatsApp o teléfono.",
    };
  }

  // En el canal web el mensaje solo se registra en la base (sin outbox ni
  // plantillas); los triggers SQL omiten compliance para canales no-WhatsApp.
  const isWhatsapp = conversation.channel === "whatsapp";
  const templateName = isWhatsapp ? (parsed.data.templateName ?? null) : null;
  const templateParams = templateName
    ? {
        language: parsed.data.templateLanguage || "es",
        ...(parsed.data.templateHeader
          ? { header: parsed.data.templateHeader }
          : {}),
        body: parsed.data.templateBodyParams ?? [],
      }
    : null;

  const { data: message, error } = await ctx.supabase
    .from("messages")
    .insert({
      conversation_id: parsed.data.conversationId,
      direction: "outbound",
      message_type: templateName ? "template" : "text",
      body: parsed.data.body,
      template_name: templateName,
      template_params: templateParams,
      sent_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return failure(error, "No se pudo poner el mensaje en cola.");

  await ctx.supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", parsed.data.conversationId);
  await audit(
    ctx.supabase,
    ctx.userId,
    "message.queued",
    "message",
    message.id,
    { conversation_id: parsed.data.conversationId }
  );
  revalidatePath(`/admin/crm/inbox/${parsed.data.conversationId}`);
  revalidatePath("/admin/crm/inbox");
  return { ok: true, id: message.id };
}

export async function setConversationStatus(
  id: string,
  status: string
): Promise<CrmActionResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "No autorizado." };
  const parsed = z
    .object({
      id: uuid,
      status: z.enum(["abierta", "pendiente", "cerrada"]),
    })
    .safeParse({ id, status });
  if (!parsed.success) return { ok: false, error: "Estado no válido." };

  const { error } = await ctx.supabase
    .from("conversations")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);
  if (error) return failure(error, "No se pudo actualizar la conversación.");
  await audit(
    ctx.supabase,
    ctx.userId,
    "conversation.status_changed",
    "conversation",
    parsed.data.id,
    { status: parsed.data.status }
  );
  revalidatePath("/admin/crm/inbox");
  revalidatePath(`/admin/crm/inbox/${parsed.data.id}`);
  return { ok: true, id: parsed.data.id };
}

export async function assignConversation(
  conversationId: string,
  assigneeId: string
): Promise<CrmActionResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "No autorizado." };
  if (!uuid.safeParse(conversationId).success) {
    return { ok: false, error: "Asignación no válida." };
  }
  const isAdmin = ctx.session.user.role === "admin";
  const nextAssignee = assigneeId.trim();
  if (nextAssignee && !uuid.safeParse(nextAssignee).success) {
    return { ok: false, error: "Asignación no válida." };
  }
  if (!isAdmin) {
    if (nextAssignee !== ctx.userId) {
      return { ok: false, error: "Solo puede tomarse conversaciones sin asignar." };
    }
  }

  const { data: current, error: currentError } = await ctx.supabase
    .from("conversations")
    .select("id, contact_id, assigned_to")
    .eq("id", conversationId)
    .single();
  if (currentError || !current) {
    return { ok: false, error: "La conversación no está disponible." };
  }
  if (!isAdmin && current.assigned_to) {
    return { ok: false, error: "La conversación ya tiene responsable." };
  }

  const { data: conversation, error } = await ctx.supabase
    .from("conversations")
    .update({ assigned_to: nextAssignee || null })
    .eq("id", conversationId)
    .select("id, contact_id")
    .single();
  if (error) return failure(error, "No se pudo asignar la conversación.");

  await ctx.supabase
    .from("contacts")
    .update({ assigned_to: nextAssignee || null })
    .eq("id", conversation.contact_id);
  if (nextAssignee) {
    await ctx.supabase.from("conversation_assignments").insert({
      conversation_id: conversationId,
      assigned_to: nextAssignee,
      assigned_by: ctx.userId,
    });
  }
  await audit(
    ctx.supabase,
    ctx.userId,
    "conversation.assigned",
    "conversation",
    conversationId,
    { assigned_to: nextAssignee || null }
  );
  revalidatePath("/admin/crm/inbox");
  revalidatePath(`/admin/crm/inbox/${conversationId}`);
  return { ok: true, id: conversationId };
}

/** Toma de control manual: desactiva la IA de la conversación y, si no tiene
 *  responsable, se asigna al propio admin. Con mode 'ia' se reactiva el bot. */
export async function setConversationBotMode(
  conversationId: string,
  mode: string
): Promise<CrmActionResult> {
  const ctx = await context(true);
  if (!ctx) return { ok: false, error: "Solo un administrador puede cambiar el control de la IA." };
  const parsed = z
    .object({
      id: uuid,
      mode: z.enum(["ia", "manual"]),
    })
    .safeParse({ id: conversationId, mode });
  if (!parsed.success) return { ok: false, error: "Modo de control no válido." };

  const { data: conversation, error } = await ctx.supabase
    .from("conversations")
    .update({ bot_mode: parsed.data.mode })
    .eq("id", parsed.data.id)
    .select("id, contact_id, assigned_to")
    .single();
  if (error) return failure(error, "No se pudo actualizar la conversación.");

  if (parsed.data.mode === "manual" && !conversation.assigned_to) {
    await ctx.supabase
      .from("conversations")
      .update({ assigned_to: ctx.userId })
      .eq("id", parsed.data.id);
    await ctx.supabase
      .from("contacts")
      .update({ assigned_to: ctx.userId })
      .eq("id", conversation.contact_id);
    await ctx.supabase.from("conversation_assignments").insert({
      conversation_id: parsed.data.id,
      assigned_to: ctx.userId,
      assigned_by: ctx.userId,
    });
  }

  await audit(
    ctx.supabase,
    ctx.userId,
    "conversation.bot_mode_changed",
    "conversation",
    parsed.data.id,
    {
      bot_mode: parsed.data.mode,
      ...(parsed.data.mode === "manual" && !conversation.assigned_to
        ? { assigned_to: ctx.userId }
        : {}),
    }
  );
  revalidatePath("/admin/crm/inbox");
  revalidatePath(`/admin/crm/inbox/${parsed.data.id}`);
  return { ok: true, id: parsed.data.id };
}

export async function createContact(input: {
  fullName: string;
  email?: string;
  phone?: string;
}): Promise<CrmActionResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "No autorizado." };
  const parsed = z
    .object({
      fullName: z.string().trim().min(2).max(120),
      email: z.union([z.email(), z.literal("")]).optional(),
      phone: z.string().trim().max(40).optional(),
    })
    .refine((value) => Boolean(value.email || value.phone), {
      message: "Ingrese email o teléfono.",
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { data, error } = await ctx.supabase
    .from("contacts")
    .insert({
      full_name: parsed.data.fullName,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      source: "manual",
      assigned_to: ctx.userId,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return failure(error, "No se pudo crear el contacto.");
  await audit(
    ctx.supabase,
    ctx.userId,
    "contact.created",
    "contact",
    data.id
  );
  revalidatePath("/admin/crm/contactos");
  return { ok: true, id: data.id };
}

export async function moveOpportunity(
  opportunityId: string,
  stageId: string
): Promise<CrmActionResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "No autorizado." };
  if (!uuid.safeParse(opportunityId).success || !uuid.safeParse(stageId).success) {
    return { ok: false, error: "Etapa no válida." };
  }
  const { error } = await ctx.supabase
    .from("opportunities")
    .update({ stage_id: stageId })
    .eq("id", opportunityId);
  if (error) return failure(error, "No se pudo mover la oportunidad.");
  await audit(
    ctx.supabase,
    ctx.userId,
    "opportunity.stage_changed",
    "opportunity",
    opportunityId,
    { stage_id: stageId }
  );
  revalidatePath("/admin/crm/pipeline");
  return { ok: true, id: opportunityId };
}

export async function createOpportunity(input: {
  contactId: string;
  stageId: string;
  title: string;
  value?: string;
  currency?: "USD" | "HNL";
  propertyId?: string;
  expectedCloseAt?: string;
}): Promise<CrmActionResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "No autorizado." };
  const parsed = z
    .object({
      contactId: uuid,
      stageId: uuid,
      title: z.string().trim().min(3).max(160),
      value: z.union([z.string().trim(), z.undefined()]),
      currency: z.enum(["USD", "HNL"]).default("USD"),
      propertyId: z.union([uuid, z.literal(""), z.undefined()]),
      expectedCloseAt: z.union([z.iso.date(), z.literal(""), z.undefined()]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Oportunidad no válida." };
  const numericValue =
    parsed.data.value && parsed.data.value.length > 0
      ? Number(parsed.data.value)
      : null;
  if (numericValue !== null && (!Number.isFinite(numericValue) || numericValue < 0)) {
    return { ok: false, error: "Valor no válido." };
  }

  const { data, error } = await ctx.supabase
    .from("opportunities")
    .insert({
      contact_id: parsed.data.contactId,
      stage_id: parsed.data.stageId,
      title: parsed.data.title,
      value: numericValue,
      currency: parsed.data.currency,
      property_id: parsed.data.propertyId || null,
      expected_close_at: parsed.data.expectedCloseAt || null,
      assigned_to: ctx.userId,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return failure(error, "No se pudo crear la oportunidad.");
  await audit(
    ctx.supabase,
    ctx.userId,
    "opportunity.created",
    "opportunity",
    data.id
  );
  revalidatePath("/admin/crm/pipeline");
  return { ok: true, id: data.id };
}

export async function createTask(input: {
  contactId: string;
  title: string;
  dueAt?: string;
  opportunityId?: string;
  description?: string;
}): Promise<CrmActionResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "No autorizado." };
  const parsed = z
    .object({
      contactId: uuid,
      title: z.string().trim().min(3).max(160),
      dueAt: z.union([z.iso.datetime(), z.literal(""), z.undefined()]),
      opportunityId: z.union([uuid, z.literal(""), z.undefined()]),
      description: z.union([z.string().trim().max(2000), z.undefined()]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Tarea no válida." };

  const { data, error } = await ctx.supabase
    .from("tasks")
    .insert({
      contact_id: parsed.data.contactId,
      title: parsed.data.title,
      due_at: parsed.data.dueAt || null,
      opportunity_id: parsed.data.opportunityId || null,
      description: parsed.data.description || null,
      assigned_to: ctx.userId,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return failure(error, "No se pudo crear la tarea.");
  await audit(ctx.supabase, ctx.userId, "task.created", "task", data.id);
  revalidatePath("/admin/crm/tareas");
  return { ok: true, id: data.id };
}

export async function setTaskStatus(
  taskId: string,
  status: "pendiente" | "completada" | "cancelada"
): Promise<CrmActionResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "No autorizado." };
  if (
    !uuid.safeParse(taskId).success ||
    !["pendiente", "completada", "cancelada"].includes(status)
  ) {
    return { ok: false, error: "Tarea no válida." };
  }
  const { error } = await ctx.supabase
    .from("tasks")
    .update({
      status,
      completed_at: status === "completada" ? new Date().toISOString() : null,
    })
    .eq("id", taskId);
  if (error) return failure(error, "No se pudo actualizar la tarea.");
  await audit(
    ctx.supabase,
    ctx.userId,
    "task.status_changed",
    "task",
    taskId,
    { status }
  );
  revalidatePath("/admin/crm/tareas");
  return { ok: true, id: taskId };
}

export async function updateContact(input: {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  notes?: string;
  status: "lead" | "prospecto" | "cliente" | "inactivo";
}): Promise<CrmActionResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "No autorizado." };
  const parsed = z
    .object({
      id: uuid,
      fullName: z.string().trim().min(2).max(120),
      email: z.union([z.email(), z.literal("")]).optional(),
      phone: z.string().trim().max(40).optional(),
      notes: z.string().trim().max(4000).optional(),
      status: z.enum(["lead", "prospecto", "cliente", "inactivo"]),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { data, error } = await ctx.supabase
    .from("contacts")
    .update({
      full_name: parsed.data.fullName,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
      status: parsed.data.status,
    })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return failure(error, "No se pudo actualizar el contacto.");
  await audit(
    ctx.supabase,
    ctx.userId,
    "contact.updated",
    "contact",
    parsed.data.id
  );
  revalidatePath("/admin/crm/contactos");
  revalidatePath(`/admin/crm/contactos/${parsed.data.id}`);
  return { ok: true, id: parsed.data.id };
}

export async function assignContact(
  contactId: string,
  assigneeId: string
): Promise<CrmActionResult> {
  const ctx = await context(true);
  if (!ctx) return { ok: false, error: "Solo el jefe puede reasignar." };
  if (!uuid.safeParse(contactId).success) {
    return { ok: false, error: "Asignación no válida." };
  }
  const nextAssignee = assigneeId.trim();
  if (nextAssignee && !uuid.safeParse(nextAssignee).success) {
    return { ok: false, error: "Asignación no válida." };
  }

  const { data, error } = await ctx.supabase
    .from("contacts")
    .update({ assigned_to: nextAssignee || null })
    .eq("id", contactId)
    .select("id")
    .maybeSingle();
  if (error || !data) return failure(error, "No se pudo asignar el contacto.");
  await audit(
    ctx.supabase,
    ctx.userId,
    "contact.assigned",
    "contact",
    contactId,
    { assigned_to: nextAssignee || null }
  );
  revalidatePath("/admin/crm/contactos");
  revalidatePath(`/admin/crm/contactos/${contactId}`);
  return { ok: true, id: contactId };
}

export async function setOpportunityStatus(
  opportunityId: string,
  status: "abierta" | "ganada" | "perdida"
): Promise<CrmActionResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "No autorizado." };
  const parsed = z
    .object({
      id: uuid,
      status: z.enum(["abierta", "ganada", "perdida"]),
    })
    .safeParse({ id: opportunityId, status });
  if (!parsed.success) return { ok: false, error: "Estado no válido." };

  const { data, error } = await ctx.supabase
    .from("opportunities")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return failure(error, "No se pudo actualizar la oportunidad.");
  await audit(
    ctx.supabase,
    ctx.userId,
    "opportunity.status_changed",
    "opportunity",
    parsed.data.id,
    { status: parsed.data.status }
  );
  revalidatePath("/admin/crm/pipeline");
  return { ok: true, id: parsed.data.id };
}

export async function updateOpportunity(input: {
  id: string;
  title: string;
  value?: string;
  currency?: "USD" | "HNL";
  propertyId?: string;
  expectedCloseAt?: string;
}): Promise<CrmActionResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "No autorizado." };
  const parsed = z
    .object({
      id: uuid,
      title: z.string().trim().min(3).max(160),
      value: z.union([z.string().trim(), z.undefined()]),
      currency: z.enum(["USD", "HNL"]).default("USD"),
      propertyId: z.union([uuid, z.literal(""), z.undefined()]),
      expectedCloseAt: z.union([z.iso.date(), z.literal(""), z.undefined()]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Oportunidad no válida." };
  const numericValue =
    parsed.data.value && parsed.data.value.length > 0
      ? Number(parsed.data.value)
      : null;
  if (numericValue !== null && (!Number.isFinite(numericValue) || numericValue < 0)) {
    return { ok: false, error: "Valor no válido." };
  }

  const { data, error } = await ctx.supabase
    .from("opportunities")
    .update({
      title: parsed.data.title,
      value: numericValue,
      currency: parsed.data.currency,
      property_id: parsed.data.propertyId || null,
      expected_close_at: parsed.data.expectedCloseAt || null,
    })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return failure(error, "No se pudo actualizar la oportunidad.");
  await audit(
    ctx.supabase,
    ctx.userId,
    "opportunity.updated",
    "opportunity",
    parsed.data.id
  );
  revalidatePath("/admin/crm/pipeline");
  return { ok: true, id: parsed.data.id };
}

export async function updateTask(input: {
  id: string;
  title: string;
  description?: string;
  dueAt?: string;
}): Promise<CrmActionResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "No autorizado." };
  const parsed = z
    .object({
      id: uuid,
      title: z.string().trim().min(3).max(160),
      description: z.union([z.string().trim().max(2000), z.undefined()]),
      dueAt: z.union([z.iso.datetime(), z.literal(""), z.undefined()]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Tarea no válida." };

  const { data, error } = await ctx.supabase
    .from("tasks")
    .update({
      title: parsed.data.title,
      description: parsed.data.description || null,
      due_at: parsed.data.dueAt || null,
    })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return failure(error, "No se pudo actualizar la tarea.");
  await audit(
    ctx.supabase,
    ctx.userId,
    "task.updated",
    "task",
    parsed.data.id
  );
  revalidatePath("/admin/crm/tareas");
  revalidatePath("/admin/crm/contactos");
  return { ok: true, id: parsed.data.id };
}

export async function assignTask(
  taskId: string,
  assigneeId: string
): Promise<CrmActionResult> {
  const ctx = await context(true);
  if (!ctx) return { ok: false, error: "Solo el jefe puede reasignar." };
  if (!uuid.safeParse(taskId).success || !uuid.safeParse(assigneeId).success) {
    return { ok: false, error: "Asignación no válida." };
  }

  const { data, error } = await ctx.supabase
    .from("tasks")
    .update({ assigned_to: assigneeId })
    .eq("id", taskId)
    .select("id")
    .maybeSingle();
  if (error || !data) return failure(error, "No se pudo asignar la tarea.");
  await audit(
    ctx.supabase,
    ctx.userId,
    "task.assigned",
    "task",
    taskId,
    { assigned_to: assigneeId }
  );
  revalidatePath("/admin/crm/tareas");
  return { ok: true, id: taskId };
}

/** Sincroniza el catálogo de plantillas de WhatsApp desde Meta. */
export async function syncTemplatesNow(): Promise<CrmActionResult> {
  const ctx = await context(true);
  if (!ctx) return { ok: false, error: "Solo el jefe puede sincronizar plantillas." };

  const result = await syncWhatsappTemplates();
  if ("error" in result) {
    return {
      ok: false,
      error:
        "No se pudieron sincronizar las plantillas. Revise META_WHATSAPP_TOKEN y META_WABA_ID.",
    };
  }
  await audit(
    ctx.supabase,
    ctx.userId,
    "templates.synced",
    "whatsapp_template",
    ctx.userId,
    { fetched: result.fetched, upserted: result.upserted }
  );
  revalidatePath("/admin/crm/configuracion");
  return { ok: true };
}

export async function optOutContact(
  contactId: string,
  reason = "Solicitud del contacto"
): Promise<CrmActionResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "No autorizado." };
  if (!uuid.safeParse(contactId).success) {
    return { ok: false, error: "Contacto no válido." };
  }
  const { data, error } = await ctx.supabase
    .from("suppression_list")
    .insert({
      contact_id: contactId,
      reason: reason.slice(0, 300),
      source: "panel",
      suppressed_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return failure(error, "No se pudo registrar la baja.");
  await audit(
    ctx.supabase,
    ctx.userId,
    "contact.opted_out",
    "contact",
    contactId,
    { suppression_id: data.id }
  );
  revalidatePath("/admin/crm/contactos");
  revalidatePath("/admin/crm/inbox");
  return { ok: true, id: data.id };
}

export async function recordContactConsent(
  contactId: string,
  category: "utility" | "marketing"
): Promise<CrmActionResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "No autorizado." };
  const parsed = z
    .object({
      contactId: uuid,
      category: z.enum(["utility", "marketing"]),
    })
    .safeParse({ contactId, category });
  if (!parsed.success) return { ok: false, error: "Consentimiento no válido." };

  const notice =
    parsed.data.category === "marketing"
      ? "Consentimiento verbal o escrito de mensajes promocionales por WhatsApp."
      : "Consentimiento verbal o escrito de mensajes de utilidad por WhatsApp.";

  const { data, error } = await ctx.supabase
    .from("consents")
    .insert({
      contact_id: parsed.data.contactId,
      channel: "whatsapp",
      category: parsed.data.category,
      granted: true,
      notice_text: notice,
      source: "panel",
      recorded_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return failure(error, "No se pudo registrar el consentimiento.");
  await audit(
    ctx.supabase,
    ctx.userId,
    "consent.recorded",
    "contact",
    parsed.data.contactId,
    { category: parsed.data.category }
  );
  revalidatePath(`/admin/crm/contactos/${parsed.data.contactId}`);
  return { ok: true, id: data.id };
}

export async function revokeContactConsent(
  contactId: string,
  category: "utility" | "marketing"
): Promise<CrmActionResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "No autorizado." };
  const parsed = z
    .object({
      contactId: uuid,
      category: z.enum(["utility", "marketing"]),
    })
    .safeParse({ contactId, category });
  if (!parsed.success) return { ok: false, error: "Consentimiento no válido." };

  const { data, error } = await ctx.supabase
    .from("consents")
    .insert({
      contact_id: parsed.data.contactId,
      channel: "whatsapp",
      category: parsed.data.category,
      granted: false,
      notice_text: "Consentimiento revocado desde el panel.",
      source: "panel",
      recorded_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return failure(error, "No se pudo revocar el consentimiento.");
  await audit(
    ctx.supabase,
    ctx.userId,
    "consent.revoked",
    "contact",
    parsed.data.contactId,
    { category: parsed.data.category }
  );
  revalidatePath(`/admin/crm/contactos/${parsed.data.contactId}`);
  return { ok: true, id: data.id };
}

export async function clearContactSuppression(
  contactId: string
): Promise<CrmActionResult> {
  const ctx = await context(true);
  if (!ctx) return { ok: false, error: "Solo el jefe puede quitar la baja." };
  if (!uuid.safeParse(contactId).success) {
    return { ok: false, error: "Contacto no válido." };
  }
  const { error } = await ctx.supabase
    .from("suppression_list")
    .delete()
    .eq("contact_id", contactId);
  if (error) return failure(error, "No se pudo quitar la baja.");
  await audit(
    ctx.supabase,
    ctx.userId,
    "contact.suppression_cleared",
    "contact",
    contactId
  );
  revalidatePath("/admin/crm/contactos");
  revalidatePath(`/admin/crm/contactos/${contactId}`);
  revalidatePath("/admin/crm/inbox");
  return { ok: true, id: contactId };
}

export async function createStage(name: string): Promise<CrmActionResult> {
  const ctx = await context(true);
  if (!ctx) return { ok: false, error: "Solo el jefe puede crear etapas." };
  const parsed = z.string().trim().min(2).max(40).safeParse(name);
  if (!parsed.success) return { ok: false, error: "Nombre de etapa no válido." };

  const { data: stages } = await ctx.supabase
    .from("pipeline_stages")
    .select("position,is_closed")
    .order("position");
  const list = stages ?? [];
  const closedPositions = list.filter((s) => s.is_closed).map((s) => s.position);
  const target = closedPositions.length
    ? Math.min(...closedPositions)
    : list.length;
  // Libera el hueco destino desplazando las etapas posteriores (la posición
  // es única en la base, así que se alejan a un rango alto antes de insertar).
  for (const stage of list.filter((s) => s.position >= target)) {
    await ctx.supabase
      .from("pipeline_stages")
      .update({ position: stage.position + 1000 })
      .eq("position", stage.position);
  }
  const { data, error } = await ctx.supabase
    .from("pipeline_stages")
    .insert({ name: parsed.data, position: target })
    .select("id")
    .single();
  if (error) return failure(error, "No se pudo crear la etapa.");
  await audit(
    ctx.supabase,
    ctx.userId,
    "pipeline_stage.created",
    "pipeline_stage",
    data.id,
    { name: parsed.data, position: target }
  );
  revalidatePath("/admin/crm/pipeline");
  return { ok: true, id: data.id };
}

export async function renameStage(
  stageId: string,
  name: string
): Promise<CrmActionResult> {
  const ctx = await context(true);
  if (!ctx) return { ok: false, error: "Solo el jefe puede renombrar etapas." };
  const parsed = z
    .object({
      id: uuid,
      name: z.string().trim().min(2).max(40),
    })
    .safeParse({ id: stageId, name });
  if (!parsed.success) return { ok: false, error: "Datos de etapa no válidos." };
  const { error } = await ctx.supabase
    .from("pipeline_stages")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.id);
  if (error) return failure(error, "No se pudo renombrar la etapa.");
  await audit(
    ctx.supabase,
    ctx.userId,
    "pipeline_stage.renamed",
    "pipeline_stage",
    parsed.data.id,
    { name: parsed.data.name }
  );
  revalidatePath("/admin/crm/pipeline");
  return { ok: true, id: parsed.data.id };
}

export async function moveStage(
  stageId: string,
  direction: "up" | "down"
): Promise<CrmActionResult> {
  const ctx = await context(true);
  if (!ctx) return { ok: false, error: "Solo el jefe puede ordenar etapas." };
  if (!uuid.safeParse(stageId).success) {
    return { ok: false, error: "Etapa no válida." };
  }
  const { data: stages } = await ctx.supabase
    .from("pipeline_stages")
    .select("id,position")
    .order("position");
  const list = stages ?? [];
  const index = list.findIndex((s) => s.id === stageId);
  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || neighborIndex < 0 || neighborIndex >= list.length) {
    return { ok: false, error: "La etapa ya está en ese extremo." };
  }
  const current = list[index].position;
  const neighbor = list[neighborIndex].position;
  // Intercambio en dos pasos para no chocar con la restricción de posición única.
  const bump = await ctx.supabase
    .from("pipeline_stages")
    .update({ position: current + 1000 })
    .eq("id", stageId);
  if (bump.error) return failure(bump.error, "No se pudo mover la etapa.");
  const shift = await ctx.supabase
    .from("pipeline_stages")
    .update({ position: current })
    .eq("id", list[neighborIndex].id);
  if (shift.error) return failure(shift.error, "No se pudo mover la etapa.");
  const settle = await ctx.supabase
    .from("pipeline_stages")
    .update({ position: neighbor })
    .eq("id", stageId);
  if (settle.error) return failure(settle.error, "No se pudo mover la etapa.");
  await audit(ctx.supabase, ctx.userId, "pipeline_stage.moved", "pipeline_stage", stageId, {
    direction,
  });
  revalidatePath("/admin/crm/pipeline");
  return { ok: true, id: stageId };
}

export async function deleteStage(stageId: string): Promise<CrmActionResult> {
  const ctx = await context(true);
  if (!ctx) return { ok: false, error: "Solo el jefe puede eliminar etapas." };
  if (!uuid.safeParse(stageId).success) {
    return { ok: false, error: "Etapa no válida." };
  }
  const { count } = await ctx.supabase
    .from("opportunities")
    .select("id", { count: "exact", head: true })
    .eq("stage_id", stageId);
  if (count && count > 0) {
    return {
      ok: false,
      error: "Mueve o cierra sus oportunidades antes de eliminar la etapa.",
    };
  }
  const { error } = await ctx.supabase
    .from("pipeline_stages")
    .delete()
    .eq("id", stageId);
  if (error) return failure(error, "No se pudo eliminar la etapa.");
  await audit(ctx.supabase, ctx.userId, "pipeline_stage.deleted", "pipeline_stage", stageId);
  revalidatePath("/admin/crm/pipeline");
  return { ok: true, id: stageId };
}

export async function deleteOpportunity(
  opportunityId: string
): Promise<CrmActionResult> {
  const ctx = await context(true);
  if (!ctx) return { ok: false, error: "Solo el jefe puede eliminar oportunidades." };
  if (!uuid.safeParse(opportunityId).success) {
    return { ok: false, error: "Oportunidad no válida." };
  }
  const { error } = await ctx.supabase
    .from("opportunities")
    .delete()
    .eq("id", opportunityId);
  if (error) return failure(error, "No se pudo eliminar la oportunidad.");
  await audit(
    ctx.supabase,
    ctx.userId,
    "opportunity.deleted",
    "opportunity",
    opportunityId
  );
  revalidatePath("/admin/crm/pipeline");
  return { ok: true, id: opportunityId };
}
