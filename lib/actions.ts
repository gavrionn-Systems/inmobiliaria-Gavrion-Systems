"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auditLog } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildCode,
  MAX_FEATURED_PROPERTIES,
  slugify,
  type PropertyInput,
} from "@/lib/property-schema";
import {
  inquirySchema,
  inquiryStatusSchema,
  propertyInputSchema,
  propertyStatusSchema,
  uuidSchema,
  type InquiryInput,
} from "@/lib/validation";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const REVALIDATE = ["/", "/propiedades", "/admin", "/admin/propiedades"];

/** Las server actions son endpoints invocables por cualquiera; el proxy solo
 *  protege páginas. Toda mutación de admin debe empezar con requireSession(). */
async function requireSession(): Promise<ActionResult | null> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "No autorizado. Inicie sesión nuevamente." };
  }
  return null;
}

async function requireAdmin(): Promise<ActionResult | null> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "No autorizado. Inicie sesión nuevamente." };
  }
  if (session.user.role !== "admin") {
    return { ok: false, error: "No tiene permisos para esta acción." };
  }
  return null;
}

/** Log interno del error real; al cliente solo se devuelve un mensaje
 *  genérico para no filtrar detalles del esquema o de PostgREST. */
function dbError(context: string, error: unknown): ActionResult {
  console.error(`[actions] Error al ${context}:`, error);
  return { ok: false, error: `No se pudo ${context}. Intente de nuevo.` };
}

function invalidId(): ActionResult {
  return { ok: false, error: "Identificador no válido." };
}

/** Busca o crea una ubicación a partir del texto que escribe el admin.
 *  Devuelve null si el campo está vacío; undefined si falló la BD. */
async function resolveLocationId(
  supabase: ReturnType<typeof createAdminClient>,
  locationName: string
): Promise<string | null | undefined> {
  const trimmed = locationName.trim();
  if (!trimmed) return null;

  const slug = slugify(trimmed);
  if (!slug) return null;

  const { data: existing, error: findError } = await supabase
    .from("locations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (findError) {
    console.error("[actions] Error al buscar ubicación:", findError);
    return undefined;
  }
  if (existing) return existing.id;

  const { data: created, error: createError } = await supabase
    .from("locations")
    .insert({
      name: trimmed,
      slug,
      country: "País",
    })
    .select("id")
    .single();
  if (createError) {
    // Carrera: otra request pudo crear el mismo slug.
    const { data: raced } = await supabase
      .from("locations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (raced) return raced.id;
    console.error("[actions] Error al crear ubicación:", createError);
    return undefined;
  }
  return created.id;
}

/* ============ Propiedades ============ */

export async function saveProperty(input: PropertyInput): Promise<ActionResult> {
  const denied = await requireSession();
  if (denied) return denied;

  const parsed = propertyInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos de la propiedad no válidos.",
    };
  }
  const data = parsed.data;

  const supabase = createAdminClient();
  const id = data.id ?? undefined;
  const slug = data.slug || slugify(data.title);
  const code = data.code || buildCode(data.title);

  const locationId = await resolveLocationId(supabase, data.location_name);
  if (locationId === undefined) {
    return { ok: false, error: "No se pudo guardar la ubicación. Intente de nuevo." };
  }

  if (data.is_featured) {
    const featuredCheck = await ensureFeaturedSlot(supabase, id);
    if (featuredCheck) return featuredCheck;
  }

  const row: Record<string, unknown> = {
    code,
    title: data.title,
    slug,
    operation: data.operation,
    status: data.status,
    price: data.price,
    currency: data.currency,
    category_id: data.category_id,
    location_id: locationId,
    municipality: (data as unknown as { municipality?: string }).municipality?.trim() || null,
    address: data.address || null,
    bedrooms: data.bedrooms,
    bathrooms: data.bathrooms,
    parking_spaces: data.parking_spaces,
    land_area_m2: data.land_area_m2,
    construction_area_m2: data.construction_area_m2,
    description: data.description || null,
    features: data.features,
    main_image_url: data.main_image_url || null,
    is_featured: data.is_featured,
    published_at:
      data.status === "publicada" ? new Date().toISOString() : null,
    map_image_url: data.map_image_url || null,
  };

  let propertyId = id;
  const trySave = async (r: Record<string, unknown>) => {
    if (id) {
      const { error } = await supabase.from("properties").update(r).eq("id", id);
      return error;
    }
    const { data: inserted, error } = await supabase.from("properties").insert(r).select("id").single();
    if (!error && inserted) propertyId = inserted.id;
    return error ?? null;
  };
  let saveError = await trySave(row);
  // Fallback si la columna municipality aún no existe en la BD (migración no aplicada)
  if (saveError && /municipality/i.test(String((saveError as unknown as { message?: string })?.message ?? ""))) {
    console.warn("[actions] municipality column missing, retry without it", saveError);
    const { municipality: _drop, ...rowWithoutMuni } = row;
    saveError = await trySave(rowWithoutMuni);
  }
  if (saveError) return dbError("guardar la propiedad", saveError);

  // Sincronización diferencial de la galería: solo se borran las imágenes
  // que el usuario quitó. Un delete total + insert dejaba la propiedad sin
  // imágenes si el insert fallaba a mitad de camino.
  if (propertyId) {
    const cleanGallery = data.gallery
      .filter((g) => g.url.trim())
      .map((g, i) => ({
        property_id: propertyId!,
        url: g.url.trim(),
        alt_text: g.alt.trim() || null,
        sort_order: i + 1,
      }));

    const { data: existing } = await supabase
      .from("property_images")
      .select("id, url")
      .eq("property_id", propertyId);

    const keepUrls = new Set(cleanGallery.map((g) => g.url));
    const toDelete = (existing ?? [])
      .filter((e) => !keepUrls.has(e.url))
      .map((e) => e.id);

    if (toDelete.length) {
      const { error } = await supabase
        .from("property_images")
        .delete()
        .in("id", toDelete);
      if (error) return dbError("actualizar la galería", error);
    }
    if (cleanGallery.length) {
      const { error } = await supabase
        .from("property_images")
        .upsert(cleanGallery, { onConflict: "property_id,url" });
      if (error) return dbError("actualizar la galería", error);
    }
  }

  REVALIDATE.forEach((p) => revalidatePath(p));
  revalidatePath("/admin/ubicaciones");
  await auditLog({ action: id ? "property.updated" : "property.created", entityType: "property", entityId: propertyId!, metadata: { status: data.status, title: data.title } });
  return { ok: true, id: propertyId! };
}

export async function deleteProperty(id: string): Promise<ActionResult> {
  const denied = await requireSession();
  if (denied) return denied;
  if (!uuidSchema.safeParse(id).success) return invalidId();

  const supabase = createAdminClient();
  const { error } = await supabase.from("properties").delete().eq("id", id);
  if (error) return dbError("eliminar la propiedad", error);
  REVALIDATE.forEach((p) => revalidatePath(p));
  await auditLog({ action: "property.deleted", entityType: "property", entityId: id });
  return { ok: true, id };
}

export async function setPropertyStatus(id: string, status: string): Promise<ActionResult> {
  const denied = await requireSession();
  if (denied) return denied;
  if (!uuidSchema.safeParse(id).success) return invalidId();
  if (!propertyStatusSchema.safeParse(status).success) {
    return { ok: false, error: "Estado no válido." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("properties")
    .update({
      status,
      published_at: status === "publicada" ? new Date().toISOString() : undefined,
    })
    .eq("id", id);
  if (error) return dbError("actualizar el estado", error);
  REVALIDATE.forEach((p) => revalidatePath(p));
  await auditLog({ action: "property.status_changed", entityType: "property", entityId: id, metadata: { status } });
  return { ok: true, id };
}

export async function toggleFeatured(id: string, featured: boolean): Promise<ActionResult> {
  const denied = await requireSession();
  if (denied) return denied;
  if (!uuidSchema.safeParse(id).success) return invalidId();

  const supabase = createAdminClient();
  if (featured) {
    const featuredCheck = await ensureFeaturedSlot(supabase, id);
    if (featuredCheck) return featuredCheck;
  }

  const { error } = await supabase
    .from("properties")
    .update({ is_featured: featured })
    .eq("id", id);
  if (error) return dbError("actualizar el destacado", error);
  revalidatePath("/");
  await auditLog({ action: "property.featured_toggled", entityType: "property", entityId: id, metadata: { featured } });
  return { ok: true, id };
}

/** Rechaza marcar una séptima destacada. Si `excludeId` ya es destacada, no cuenta. */
async function ensureFeaturedSlot(
  supabase: ReturnType<typeof createAdminClient>,
  excludeId?: string
): Promise<ActionResult | null> {
  let query = supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("is_featured", true);
  if (excludeId) query = query.neq("id", excludeId);

  const { count, error } = await query;
  if (error) return dbError("verificar destacadas", error);
  if ((count ?? 0) >= MAX_FEATURED_PROPERTIES) {
    return {
      ok: false,
      error: `Solo se permiten ${MAX_FEATURED_PROPERTIES} propiedades destacadas. Quite el destacado de otra para marcar esta.`,
    };
  }
  return null;
}

/* ============ Categorías ============ */

export async function createCategory({ name }: { name: string }): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 60) {
    return { ok: false, error: "Escribe un nombre de 2 a 60 caracteres." };
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({ name: trimmed, slug: slugify(trimmed) })
    .select("id")
    .single();
  if (error) return dbError("crear la categoría", error);
  revalidatePath("/admin/categorias");
  revalidatePath("/admin/propiedades/nueva");
  await auditLog({ action: "category.created", entityType: "category", entityId: data.id, metadata: { name: trimmed } });
  return { ok: true, id: data.id };
}

export async function updateCategory({
  id,
  name,
}: {
  id: string;
  name: string;
}): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!uuidSchema.safeParse(id).success) return invalidId();

  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 60) {
    return { ok: false, error: "Escribe un nombre de 2 a 60 caracteres." };
  }
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("categories")
    .update({ name: trimmed, slug: slugify(trimmed) })
    .eq("id", id);
  if (error) return dbError("actualizar la categoría", error);
  revalidatePath("/admin/categorias");
  revalidatePath("/admin/propiedades/nueva");
  await auditLog({ action: "category.updated", entityType: "category", entityId: id, metadata: { name: trimmed } });
  return { ok: true, id };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!uuidSchema.safeParse(id).success) return invalidId();

  const supabase = createAdminClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return dbError("eliminar la categoría", error);
  revalidatePath("/admin/categorias");
  await auditLog({ action: "category.deleted", entityType: "category", entityId: id });
  return { ok: true, id };
}

/* ============ Ubicaciones ============ */

export async function createLocation({
  name,
  country,
}: {
  name: string;
  country: string | null;
}): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 80) {
    return { ok: false, error: "Escribe un nombre de 2 a 80 caracteres." };
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("locations")
    .insert({
      name: trimmed,
      slug: slugify(trimmed),
      country: (country ?? "").trim() || "País",
    })
    .select("id")
    .single();
  if (error) return dbError("crear la ubicación", error);
  revalidatePath("/admin/ubicaciones");
  revalidatePath("/admin/propiedades/nueva");
  await auditLog({ action: "location.created", entityType: "location", entityId: data.id, metadata: { name: trimmed } });
  return { ok: true, id: data.id };
}

export async function updateLocation({
  id,
  name,
  country,
}: {
  id: string;
  name: string;
  country: string | null;
}): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!uuidSchema.safeParse(id).success) return invalidId();

  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 80) {
    return { ok: false, error: "Escribe un nombre de 2 a 80 caracteres." };
  }
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("locations")
    .update({
      name: trimmed,
      slug: slugify(trimmed),
      country: (country ?? "").trim() || "País",
    })
    .eq("id", id);
  if (error) return dbError("actualizar la ubicación", error);
  revalidatePath("/admin/ubicaciones");
  revalidatePath("/admin/propiedades/nueva");
  await auditLog({ action: "location.updated", entityType: "location", entityId: id, metadata: { name: trimmed } });
  return { ok: true, id };
}

export async function deleteLocation(id: string): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!uuidSchema.safeParse(id).success) return invalidId();

  const supabase = createAdminClient();
  const { error } = await supabase.from("locations").delete().eq("id", id);
  if (error) return dbError("eliminar la ubicación", error);
  revalidatePath("/admin/ubicaciones");
  await auditLog({ action: "location.deleted", entityType: "location", entityId: id });
  return { ok: true, id };
}

/* ============ Solicitudes (admin) ============ */

export async function setInquiryStatus(id: string, status: string): Promise<ActionResult> {
  const denied = await requireSession();
  if (denied) return denied;
  if (!uuidSchema.safeParse(id).success) return invalidId();
  if (!inquiryStatusSchema.safeParse(status).success) {
    return { ok: false, error: "Estado no válido." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("inquiries")
    .update({ status })
    .eq("id", id);
  if (error) return dbError("actualizar la solicitud", error);
  revalidatePath("/admin/solicitudes");
  await auditLog({ action: "inquiry.status_changed", entityType: "inquiry", entityId: id, metadata: { status } });
  return { ok: true, id };
}

/* ============ Solicitudes del sitio público ============ */

export async function createInquiry(
  input: InquiryInput & { empresa?: string }
): Promise<ActionResult> {
  // Honeypot: los bots rellenan el campo oculto "empresa". Se simula éxito
  // para no revelar que fue detectado.
  if (input.empresa && input.empresa.trim().length > 0) {
    return { ok: true };
  }

  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocido";
  if (!rateLimit(`inquiry:${ip}`, 5, 10 * 60 * 1000)) {
    return {
      ok: false,
      error: "Ha enviado demasiados mensajes. Intente de nuevo más tarde.",
    };
  }

  const parsed = inquirySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("inquiries").insert({
    full_name: parsed.data.full_name,
    email: parsed.data.email,
    phone: parsed.data.phone || null,
    subject: parsed.data.subject,
    message: parsed.data.message,
    property_id: parsed.data.property_id,
    status: "nueva",
  });
  if (error) return dbError("enviar el mensaje", error);
  return { ok: true };
}
