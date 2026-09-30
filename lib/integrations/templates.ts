import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { metaWhatsappToken } from "@/lib/integrations/meta-token";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";
const ALLOWED_CATEGORIES = new Set(["MARKETING", "UTILITY", "AUTHENTICATION"]);
const ALLOWED_STATUSES = new Set([
  "PENDING",
  "APPROVED",
  "PAUSED",
  "REJECTED",
  "DISABLED",
]);

export type TemplateSyncResult =
  | { ok: true; fetched: number; upserted: number }
  | { ok: false; error: string; status: number };

type GraphTemplate = {
  id?: string;
  name?: string;
  language?: string;
  category?: string;
  status?: string;
  components?: { type?: string; text?: string }[];
};

function bodyPreview(template: GraphTemplate): string | null {
  const body = (template.components ?? []).find(
    (component) => component?.type === "BODY"
  );
  return typeof body?.text === "string" && body.text.length > 0
    ? body.text.slice(0, 1000)
    : null;
}

/** Sincroniza las plantillas de WhatsApp desde la Graph API hacia la tabla
 *  whatsapp_templates. Usa META_WHATSAPP_TOKEN (o el alias META_TEMPLATES_TOKEN)
 *  y META_WABA_ID. Idempotente: upsert por (name, language). */
export async function syncWhatsappTemplates(): Promise<TemplateSyncResult> {
  const token = metaWhatsappToken();
  const wabaId = process.env.META_WABA_ID ?? "";
  if (!token || !wabaId) {
    return {
      ok: false,
      error:
        "Faltan META_WHATSAPP_TOKEN o META_WABA_ID; el sync de plantillas no está configurado.",
      status: 503,
    };
  }

  const templates: GraphTemplate[] = [];
  let url: string | null =
    `${GRAPH_BASE}/${encodeURIComponent(wabaId)}/message_templates` +
    `?fields=id,name,language,category,status,components&limit=100`;
  let pages = 0;

  while (url && pages < 10) {
    pages += 1;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(
        `[templates-sync] Graph API respondió HTTP ${response.status}`
      );
      return {
        ok: false,
        error: "La Graph API rechazó la consulta de plantillas.",
        status: 502,
      };
    }
    const json = (await response.json()) as {
      data?: GraphTemplate[];
      paging?: { next?: string };
    };
    templates.push(...(json.data ?? []));
    url = json.paging?.next ?? null;
  }

  const rows = templates
    .filter(
      (template) =>
        typeof template.name === "string" &&
        template.name.length > 0 &&
        ALLOWED_CATEGORIES.has(template.category ?? "") &&
        ALLOWED_STATUSES.has(template.status ?? "")
    )
    .map((template) => ({
      meta_template_id: template.id ?? null,
      name: template.name as string,
      language: template.language || "es",
      category: template.category as string,
      status: template.status as string,
      body_preview: bodyPreview(template),
      components: template.components ?? [],
      updated_at: new Date().toISOString(),
    }));

  if (rows.length > 0) {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("whatsapp_templates")
      .upsert(rows, { onConflict: "name,language" });
    if (error) {
      console.error("[templates-sync] Upsert falló:", error);
      return {
        ok: false,
        error: "No se pudieron guardar las plantillas.",
        status: 500,
      };
    }
  }

  return { ok: true, fetched: templates.length, upserted: rows.length };
}
