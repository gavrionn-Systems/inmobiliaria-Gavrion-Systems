export type PropertyStatus = "borrador" | "publicada" | "vendida" | "archivada";
export type Operation = "venta" | "alquiler";

/** Máximo de propiedades marcadas como destacadas en el panel y en portada. */
export const MAX_FEATURED_PROPERTIES = 6;

export interface PropertyInput {
  id?: string;
  code: string;
  title: string;
  slug: string;
  operation: Operation;
  status: PropertyStatus;
  price: number;
  currency: string;
  category_id: string | null;
  location_name: string;
  municipality: string;
  address: string;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  land_area_m2: number | null;
  construction_area_m2: number | null;
  description: string;
  features: { icon: string; label: string }[];
  main_image_url: string;
  gallery: { url: string; alt: string }[];
  is_featured: boolean;
  map_image_url: string;
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function buildCode(title: string): string {
  const prefix = slugify(title).slice(0, 3).toUpperCase() || "PRP";
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `PRP-${prefix}-${stamp}${rand}`;
}

/** La instalación puede definir sus ubicaciones desde Administración. */
export const LOCATION_OPTIONS = [] as const;
