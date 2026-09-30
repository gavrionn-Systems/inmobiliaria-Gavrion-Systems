import "server-only";
import { images, type PropertySummary } from "@/lib/properties";
import { formatPrice } from "@/lib/format";
import { MAX_FEATURED_PROPERTIES, LOCATION_OPTIONS } from "@/lib/property-schema";
import { createPublicClient } from "@/lib/supabase/public";

export type PublicProperty = {
  id: string;
  code: string;
  title: string;
  slug: string;
  operation: "venta" | "alquiler";
  status: string;
  price: number;
  currency: string;
  category_id: string | null;
  location_id: string | null;
  municipality: string | null;
  address: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  land_area_m2: number | null;
  construction_area_m2: number | null;
  description: string | null;
  features: { icon: string; label: string }[];
  main_image_url: string | null;
  map_image_url: string | null;
  is_featured: boolean;
  published_at: string | null;
  created_at: string;
  categories: { name: string; slug: string } | null;
  locations: { name: string; country: string; slug: string } | null;
  property_images: { url: string; alt_text: string | null; sort_order: number }[];
};

const PUBLIC_SELECT =
  "*, categories(name, slug), locations(name, country, slug), property_images(url, alt_text, sort_order)";

export function toPropertySummary(p: PublicProperty): PropertySummary {
  const sold = p.status === "vendida";
  return {
    id: p.slug,
    title: p.title,
    location: p.locations?.name ?? "Consulte la ubicación",
    price: formatPrice(p.price, p.currency, p.operation),
    bedrooms: p.bedrooms ?? undefined,
    bathrooms: p.bathrooms ?? undefined,
    area: p.construction_area_m2 ?? p.land_area_m2 ?? undefined,
    type: p.categories?.name,
    image: p.main_image_url ?? images.hero,
    imageAlt: p.property_images[0]?.alt_text ?? p.title,
    status: sold ? "vendido" : p.is_featured ? "destacado" : "disponible",
  };
}

export async function getPublishedProperties() {
  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("properties")
    .select(PUBLIC_SELECT)
    .eq("status", "publicada")
    .order("published_at", { ascending: false });
  if (error) throw error;
  return data as unknown as PublicProperty[];
}

export type CatalogSort = "recientes" | "precio-asc" | "precio-desc";

export type CatalogParams = {
  q?: string;
  operation?: "venta" | "alquiler";
  categoryId?: string;
  locationId?: string;
  municipality?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  sort?: CatalogSort;
  page?: number;
  perPage?: number;
};

export async function getCatalogPerPage(): Promise<number> {
  try {
    const { getSiteSettings } = await import("@/lib/site-settings");
    const s = await getSiteSettings();
    if (typeof s.catalogPerPage === "number" && s.catalogPerPage >= 6 && s.catalogPerPage <= 48) return s.catalogPerPage;
  } catch {}
  return 12;
}

export async function getFeaturedLimit(): Promise<number> {
  try {
    const { getSiteSettings } = await import("@/lib/site-settings");
    const s = await getSiteSettings();
    if (typeof s.featuredLimit === "number" && s.featuredLimit >= 3 && s.featuredLimit <= 12) return s.featuredLimit;
  } catch {}
  return MAX_FEATURED_PROPERTIES;
}

export async function getRelatedLimit(): Promise<number> {
  try {
    const { getSiteSettings } = await import("@/lib/site-settings");
    const s = await getSiteSettings();
    if (typeof s.relatedLimit === "number" && s.relatedLimit >= 0 && s.relatedLimit <= 6) return s.relatedLimit;
  } catch {}
  return 3;
}

/** Catálogo público paginado y filtrado en base de datos (no en memoria). */
export async function getCatalogPage(params: CatalogParams) {
  const defaultPerPage = await getCatalogPerPage();
  const perPage = Math.min(Math.max(params.perPage ?? defaultPerPage, 1), 48);
  const page = Math.max(params.page ?? 1, 1);
  const supabase = createPublicClient();
  if (!supabase) return { rows: [], total: 0, page, perPage };

  let query = supabase
    .from("properties")
    .select(PUBLIC_SELECT, { count: "exact" })
    .eq("status", "publicada");

  const q = params.q?.trim().replace(/[%_,()."]/g, " ").trim() ?? "";
  if (q) {
    const { data: matchingLocations } = await supabase
      .from("locations")
      .select("id")
      .ilike("name", `%${q}%`);
    const locationIds = (matchingLocations ?? []).map((l) => l.id);
    const conditions = [`title.ilike.%${q}%`, `address.ilike.%${q}%`];
    if (locationIds.length > 0) {
      conditions.push(`location_id.in.(${locationIds.join(",")})`);
    }
    query = query.or(conditions.join(","));
  }

  if (params.operation) {
    query = query.eq("operation", params.operation);
  }
  if (params.categoryId) {
    query = query.eq("category_id", params.categoryId);
  }
  if (params.locationId) {
    query = query.eq("location_id", params.locationId);
  }
  if (params.municipality) {
    // municipality es columna nueva; si la migración aún no está aplicada, este filtro se ignora
    // para no romper el catálogo (el error se captura abajo y se reintenta sin filtro)
    query = query.ilike("municipality", params.municipality);
  }
  if (params.minPrice != null) {
    query = query.gte("price", params.minPrice);
  }
  if (params.maxPrice != null) {
    query = query.lte("price", params.maxPrice);
  }
  if (params.minBeds) {
    query = query.gte("bedrooms", params.minBeds);
  }

  if (params.sort === "precio-asc") {
    query = query.order("price", { ascending: true });
  } else if (params.sort === "precio-desc") {
    query = query.order("price", { ascending: false });
  } else {
    query = query.order("published_at", { ascending: false });
  }

  const from = (page - 1) * perPage;
  let { data, error, count } = await query.range(from, from + perPage - 1);
  if (error && /municipality/i.test(String((error as unknown as { message?: string })?.message ?? ""))) {
    console.warn("[queries] municipality filter failed, retry without it", error);
    // reintenta sin filtro de municipio si la columna no existe
    let fallbackQuery = supabase
      .from("properties")
      .select(PUBLIC_SELECT, { count: "exact" })
      .eq("status", "publicada");
    if (q) {
      const { data: matchingLocations } = await supabase.from("locations").select("id").ilike("name", `%${q}%`);
      const locationIds = (matchingLocations ?? []).map((l) => l.id);
      const conditions = [`title.ilike.%${q}%`, `address.ilike.%${q}%`];
      if (locationIds.length > 0) conditions.push(`location_id.in.(${locationIds.join(",")})`);
      fallbackQuery = fallbackQuery.or(conditions.join(","));
    }
    if (params.operation) fallbackQuery = fallbackQuery.eq("operation", params.operation);
    if (params.categoryId) fallbackQuery = fallbackQuery.eq("category_id", params.categoryId);
    if (params.locationId) fallbackQuery = fallbackQuery.eq("location_id", params.locationId);
    if (params.minPrice != null) fallbackQuery = fallbackQuery.gte("price", params.minPrice);
    if (params.maxPrice != null) fallbackQuery = fallbackQuery.lte("price", params.maxPrice);
    if (params.minBeds) fallbackQuery = fallbackQuery.gte("bedrooms", params.minBeds);
    if (params.sort === "precio-asc") fallbackQuery = fallbackQuery.order("price", { ascending: true });
    else if (params.sort === "precio-desc") fallbackQuery = fallbackQuery.order("price", { ascending: false });
    else fallbackQuery = fallbackQuery.order("published_at", { ascending: false });
    const retry = await fallbackQuery.range(from, from + perPage - 1);
    data = retry.data as unknown as typeof data;
    error = retry.error;
    count = retry.count;
  }
  if (error) throw error;

  return {
    rows: (data ?? []) as unknown as PublicProperty[],
    total: count ?? 0,
    page,
    perPage,
  };
}

export type CatalogPriceBounds = {
  floor: number;
  ceiling: number;
  step: number;
};

export const CATALOG_PRICE_STEP = 5_000;
const MIN_PRICE_CEILING = 100_000;

function roundUpToPriceStep(value: number, step = CATALOG_PRICE_STEP): number {
  return Math.ceil(value / step) * step;
}

/** Techo del slider de precio según el máximo publicado (redondeado a pasos configurables). */
export async function getCatalogPriceBounds(): Promise<CatalogPriceBounds> {
  let step = CATALOG_PRICE_STEP;
  let floor = 0;
  let ceilingOverride: number | null = null;
  try {
    const { getSiteSettings } = await import("@/lib/site-settings");
    const s = await getSiteSettings();
    if (typeof s.priceStep === "number" && s.priceStep >= 1000) step = s.priceStep;
    if (typeof s.priceFloor === "number" && s.priceFloor >= 0) floor = s.priceFloor;
    if (typeof s.priceCeilingOverride === "number" && s.priceCeilingOverride >= 10000)
      ceilingOverride = s.priceCeilingOverride;
  } catch {}
  if (ceilingOverride) return { floor, ceiling: roundUpToPriceStep(ceilingOverride, step), step };
  const supabase = createPublicClient();
  if (!supabase) return { floor, ceiling: MIN_PRICE_CEILING, step };
  const { data, error } = await supabase
    .from("properties")
    .select("price")
    .eq("status", "publicada")
    .order("price", { ascending: false })
    .limit(1);

  if (error || !data?.[0]?.price) {
    return { floor, ceiling: MIN_PRICE_CEILING, step };
  }

  const ceiling = Math.max(
    MIN_PRICE_CEILING,
    roundUpToPriceStep(Number(data[0].price), step)
  );
  return { floor, ceiling, step };
}

export async function getFeaturedProperties(limit?: number) {
  const supabase = createPublicClient();
  if (!supabase) return [];
  const effectiveLimit = limit ?? (await getFeaturedLimit());
  const { data, error } = await supabase
    .from("properties")
    .select(PUBLIC_SELECT)
    .eq("status", "publicada")
    .eq("is_featured", true)
    .order("published_at", { ascending: false })
    .limit(effectiveLimit);
  if (error) throw error;
  return data as unknown as PublicProperty[];
}

export async function getPropertyBySlug(slug: string) {
  const supabase = createPublicClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("properties")
    .select(PUBLIC_SELECT)
    .eq("status", "publicada")
    .eq("slug", slug)
    .single();
  if (error) {
    // PGRST116 = cero filas: la propiedad no existe (404 legítimo).
    // Cualquier otro error (red, esquema, RLS) se propaga en vez de
    // disfrazarse de "no encontrada".
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as unknown as PublicProperty;
}

export async function getRelatedProperties(
  locationId: string | null,
  categoryId: string | null,
  excludeId: string,
  limit?: number
) {
  const effectiveLimit = limit ?? (await getRelatedLimit());
  if (effectiveLimit === 0) return [];
  const supabase = createPublicClient();
  if (!supabase) return [];
  let query = supabase
    .from("properties")
    .select(PUBLIC_SELECT)
    .eq("status", "publicada")
    .neq("id", excludeId)
    .limit(effectiveLimit);

  if (locationId) query = query.eq("location_id", locationId);
  else if (categoryId) query = query.eq("category_id", categoryId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as PublicProperty[];
}

export async function getCategoriesPublic() {
  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, icon")
    .order("name");
  if (error) throw error;
  return data;
}

export async function getLocationsPublic() {
  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("locations")
    .select("id, name, slug, country")
    .in("name", LOCATION_OPTIONS)
    .order("name");
  if (error) throw error;
  return data;
}
