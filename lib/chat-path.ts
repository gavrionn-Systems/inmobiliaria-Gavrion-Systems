/** Slug de ficha si la ruta es /propiedades/[slug]; no el listado. */
export function propertySlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/propiedades\/([^/]+)\/?$/);
  if (!match) return null;
  const slug = decodeURIComponent(match[1] ?? "").trim();
  if (!slug || slug === "page") return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) return null;
  return slug;
}
