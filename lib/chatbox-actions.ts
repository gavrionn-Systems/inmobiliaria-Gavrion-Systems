"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { isPlatformRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";

export type ChatboxActionResult = { ok: true } | { ok: false; error: string };

const chatboxSchema = z.object({
  enabled: z.boolean(),
  welcome: z.string().trim().min(1).max(300),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use un color hexadecimal válido."),
  statusMessage: z.string().trim().min(1).max(160),
  offlineMessage: z.string().trim().min(1).max(300),
  position: z.enum(["left", "right"]),
  launcher: z.string().trim().min(1).max(4),
  assistantEnabled: z.boolean(),
  assistantName: z.string().trim().min(1).max(100),
  assistantInstructions: z.string().trim().max(2000),
  handoffMessage: z.string().trim().min(1).max(300),
  knowledge: z.string().trim().max(12000),
});

async function canEditChatbox() {
  const session = await getSession();
  return Boolean(session && isPlatformRole(session.user.role));
}

export async function saveChatboxSettings(input: unknown): Promise<ChatboxActionResult> {
  if (!(await canEditChatbox())) return { ok: false, error: "No tiene permisos para configurar el chatbox." };
  const parsed = chatboxSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };

  const { data: current } = await createAdminClient()
    .from("chatbox_settings")
    .select("widget_key")
    .eq("id", 1)
    .maybeSingle();
  const { error } = await createAdminClient().from("chatbox_settings").upsert(
    {
      id: 1,
      widget_key: current?.widget_key || randomUUID(),
      enabled: parsed.data.enabled,
      welcome: parsed.data.welcome,
      color: parsed.data.color.toLowerCase(),
      status_message: parsed.data.statusMessage,
      offline_message: parsed.data.offlineMessage,
      position: parsed.data.position,
      launcher: parsed.data.launcher,
      assistant_enabled: parsed.data.assistantEnabled,
      assistant_name: parsed.data.assistantName,
      assistant_instructions: parsed.data.assistantInstructions,
      handoff_message: parsed.data.handoffMessage,
      knowledge: parsed.data.knowledge,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) return { ok: false, error: "No se pudo guardar la configuración del chatbox." };
  revalidatePath("/", "layout");
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/crm/inbox");
  return { ok: true };
}

export async function regenerateChatboxKey(): Promise<ChatboxActionResult> {
  if (!(await canEditChatbox())) return { ok: false, error: "No tiene permisos para regenerar la clave." };
  const { error } = await createAdminClient()
    .from("chatbox_settings")
    .update({ widget_key: randomUUID(), updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { ok: false, error: "No se pudo regenerar la clave del chatbox." };
  revalidatePath("/admin/configuracion");
  return { ok: true };
}
