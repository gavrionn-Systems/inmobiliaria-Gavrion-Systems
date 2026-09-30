/** Origen público que debe usarse en enlaces devueltos por el catálogo al chat. */
export function propertyLinkBase(requestUrl: string): string {
  return new URL(requestUrl).origin;
}
