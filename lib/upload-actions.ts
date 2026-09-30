"use server";

import { auditLog } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const PROPERTY_IMAGES_BUCKET = "property-images";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ["image/webp", "image/jpeg", "image/png"] as const;
const EXTENSION: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/** Sanea el prefijo de carpeta que llega del cliente: solo se usa para
 *  agrupar los archivos, nunca para autorizar. */
function safeFolder(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "sin-asignar";
  const clean = value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 60);
  return clean || "sin-asignar";
}

/** Extrae la ruta dentro del bucket a partir de la URL pública.
 *  Devuelve null si la URL apunta a otro origen (imágenes externas heredadas). */
function pathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${PROPERTY_IMAGES_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const path = url.slice(index + marker.length).split("?")[0];
  return path ? decodeURIComponent(path) : null;
}

export async function uploadPropertyImage(
  formData: FormData
): Promise<UploadResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "No tiene permisos para subir imágenes." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No se recibió ningún archivo." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "La imagen supera el límite de 10 MB." };
  }
  if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
    return { ok: false, error: "Formato no admitido. Use JPG, PNG o WebP." };
  }

  const folder = safeFolder(formData.get("folder"));
  const path = `${folder}/${crypto.randomUUID()}.${EXTENSION[file.type]}`;

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(PROPERTY_IMAGES_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) {
    console.error("[upload] Error al subir la imagen:", error);
    return { ok: false, error: "No se pudo subir la imagen. Intente de nuevo." };
  }

  const { data } = supabase.storage
    .from(PROPERTY_IMAGES_BUCKET)
    .getPublicUrl(path);
  await auditLog({ action: "storage.uploaded", entityType: "property_image", entityId: path, metadata: { folder } });
  return { ok: true, url: data.publicUrl };
}

export async function deletePropertyImage(url: string): Promise<UploadResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "No tiene permisos para eliminar imágenes." };
  }

  const path = pathFromPublicUrl(url);
  // Las imágenes externas solo se quitan del formulario; no hay archivo que borrar.
  if (!path) return { ok: true, url };

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(PROPERTY_IMAGES_BUCKET)
    .remove([path]);
  if (error) {
    console.error("[upload] Error al eliminar la imagen:", error);
    return { ok: false, error: "No se pudo eliminar la imagen del servidor." };
  }
  await auditLog({ action: "storage.deleted", entityType: "property_image", entityId: path, metadata: { url } });
  return { ok: true, url };
}
