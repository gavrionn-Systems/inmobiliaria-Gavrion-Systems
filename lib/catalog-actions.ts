"use server";

import type { LocationOption } from "@/lib/location-catalog";
import { getLocationsPublic } from "@/lib/queries";

/**
 * Devuelve departamentos + municipios desde la BD. Lo usa PropertyForm cuando
 * la página que lo renderiza no le pasa `locations` (p. ej. la de edición).
 * Son datos de referencia públicos (RLS de solo lectura para anon).
 */
export async function loadLocationCatalog(): Promise<LocationOption[]> {
  try {
    const rows = await getLocationsPublic();
    return rows.map(({ id, name, municipalities }) => ({ id, name, municipalities }));
  } catch (error) {
    console.error("[catalog-actions] Error al leer ubicaciones:", error);
    return [];
  }
}
