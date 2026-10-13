import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_CHATBOX_SETTINGS,
  type ChatboxSettings,
} from "@/lib/chatbox-types";

export async function getChatboxSettings(): Promise<ChatboxSettings> {
  const { data, error } = await createAdminClient()
    .from("chatbox_settings")
    .select(
      "id, enabled, widget_key, welcome, color, status_message, offline_message, position, launcher, assistant_enabled, assistant_name, assistant_instructions, handoff_message, knowledge"
    )
    .eq("id", 1)
    .maybeSingle();

  // Mientras la migración no exista, no mostrar un widget que luego no podrá
  // persistir mensajes. Después de aplicar la migración se crea id=1.
  if (error || !data) return { ...DEFAULT_CHATBOX_SETTINGS, enabled: false };
  return {
    ...DEFAULT_CHATBOX_SETTINGS,
    ...data,
    position: data.position === "left" ? "left" : "right",
  } as ChatboxSettings;
}

export function widgetKeyIsValid(
  requestedKey: string | null | undefined,
  settings: ChatboxSettings
): boolean {
  const key = requestedKey?.trim() ?? "";
  // "site" is reserved for the script installed by this same deployment.
  // External installations must use the public UUID shown in the admin panel.
  return key === "site" || (Boolean(settings.widget_key) && key === settings.widget_key);
}

export function safeWidgetColor(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : DEFAULT_CHATBOX_SETTINGS.color;
}
