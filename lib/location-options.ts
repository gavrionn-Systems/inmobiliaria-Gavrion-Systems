/** Opciones regionales opcionales. Cada instalación puede extenderlas. */
export const LOCATION_MUNICIPALITIES: Record<string, string[]> = {};

export function municipalitiesFor(locationName: string): string[] {
  return LOCATION_MUNICIPALITIES[locationName] ?? [];
}
