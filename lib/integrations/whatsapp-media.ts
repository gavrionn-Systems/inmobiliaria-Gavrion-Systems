import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { metaWhatsappToken } from "@/lib/integrations/meta-token";
import type { SupabaseClient } from "@supabase/supabase-js";

export const CRM_MEDIA_BUCKET = "crm-media";
export const CRM_MEDIA_PREFIX = "crm-storage:";
const GRAPH_BASE = "https://graph.facebook.com/v21.0";
const MAX_BYTES = 16 * 1024 * 1024;
const SIGNED_URL_SECONDS = 60 * 60;
const BATCH_SIZE = 10;

const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "application/pdf": "pdf",
};

type MediaRow = {
  id: string;
  conversation_id: string;
  media_url: string | null;
};

function extensionFor(mime: string): string {
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  return MIME_EXTENSION[base] ?? "bin";
}

function storagePathFromUrl(url: string | null): string | null {
  if (!url?.startsWith(CRM_MEDIA_PREFIX)) return null;
  const path = url.slice(CRM_MEDIA_PREFIX.length);
  if (
    !path ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    return null;
  }
  return path;
}

export async function signCrmMediaUrls<T extends { media_url: string | null }>(
  supabase: SupabaseClient,
  messages: T[]
): Promise<T[]> {
  const paths = messages
    .map((message) => storagePathFromUrl(message.media_url))
    .filter((path): path is string => Boolean(path));
  if (paths.length === 0) return messages;

  const signed = new Map<string, string>();
  const { data, error } = await supabase.storage
    .from(CRM_MEDIA_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) {
    console.error("[crm-media] No se pudieron firmar URLs:", error);
    return messages;
  }
  for (const item of data ?? []) {
    const url =
      item.signedUrl ||
      ("signedURL" in item ? String(item.signedURL ?? "") : "");
    if (item.path && url) signed.set(item.path, url);
  }

  return messages.map((message) => {
    const path = storagePathFromUrl(message.media_url);
    if (!path) return message;
    const url = signed.get(path);
    return url ? { ...message, media_url: url } : message;
  });
}

async function ingestOne(
  supabase: ReturnType<typeof createAdminClient>,
  token: string,
  row: MediaRow
): Promise<boolean> {
  const mediaId = row.media_url?.startsWith("meta-media:")
    ? row.media_url.slice("meta-media:".length)
    : "";
  if (!mediaId || /[^a-zA-Z0-9_-]/.test(mediaId)) return false;

  const metaResponse = await fetch(
    `${GRAPH_BASE}/${encodeURIComponent(mediaId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    }
  );
  if (!metaResponse.ok) {
    console.error(
      `[crm-media] Graph API ${metaResponse.status} para ${mediaId}`
    );
    return false;
  }
  const meta = (await metaResponse.json()) as {
    url?: string;
    mime_type?: string;
  };
  if (!meta.url) return false;

  const binaryResponse = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!binaryResponse.ok) {
    console.error(
      `[crm-media] Descarga ${binaryResponse.status} para ${mediaId}`
    );
    return false;
  }

  const mime =
    meta.mime_type ||
    binaryResponse.headers.get("content-type") ||
    "application/octet-stream";
  const bytes = Buffer.from(await binaryResponse.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return false;

  const path = `${row.conversation_id}/${row.id}.${extensionFor(mime)}`;
  const { error: uploadError } = await supabase.storage
    .from(CRM_MEDIA_BUCKET)
    .upload(path, bytes, { contentType: mime.split(";")[0], upsert: true });
  if (uploadError) {
    console.error("[crm-media] Upload falló:", uploadError);
    return false;
  }

  const { error: updateError } = await supabase
    .from("messages")
    .update({ media_url: `${CRM_MEDIA_PREFIX}${path}` })
    .eq("id", row.id)
    .like("media_url", "meta-media:%");
  if (updateError) {
    console.error("[crm-media] No se pudo actualizar media_url:", updateError);
    return false;
  }
  return true;
}

/** Baja adjuntos pendientes (`meta-media:<id>`) a Storage. Idempotente. */
export async function ingestPendingWhatsappMedia(): Promise<{
  scanned: number;
  stored: number;
}> {
  const token = metaWhatsappToken();
  if (!token) return { scanned: 0, stored: 0 };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, media_url")
    .like("media_url", "meta-media:%")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (error) {
    console.error("[crm-media] No se pudieron listar pendientes:", error);
    return { scanned: 0, stored: 0 };
  }

  const rows = (data ?? []) as MediaRow[];
  let stored = 0;
  for (const row of rows) {
    try {
      if (await ingestOne(supabase, token, row)) stored += 1;
    } catch (ingestError) {
      console.error("[crm-media] Falló un adjunto:", ingestError);
    }
  }
  return { scanned: rows.length, stored };
}
