export async function getLocationsPublic(): Promise<LocationRow[]> {
  const supabase = createPublicClient();
  if (!supabase) return [];

  // Si la instalación define una lista fija (LOCATION_OPTIONS) se filtra por
  // ella; si está vacía, la fuente es solo la tabla `locations` de la BD.
  const allowed = LOCATION_OPTIONS as readonly string[];

  let withMunisQuery = supabase
    .from("locations")
    .select("id, name, slug, country, municipalities(name)")
    .order("name");
  if (allowed.length > 0) withMunisQuery = withMunisQuery.in("name", allowed);
  const withMunis = await withMunisQuery;

  if (!withMunis.error) {
    type Row = Omit<LocationRow, "municipalities"> & {
      municipalities: { name: string }[] | null;
    };
    return ((withMunis.data ?? []) as unknown as Row[]).map((l) => ({
      id: l.id,
      name: l.name,
      slug: l.slug,
      country: l.country,
      municipalities: (l.municipalities ?? [])
        .map((m) => m.name)
        .sort((a, b) => a.localeCompare(b, "es")),
    }));
  }

  console.warn("[queries] municipalities no disponible, se usa catálogo estático", withMunis.error);
  let plainQuery = supabase
    .from("locations")
    .select("id, name, slug, country")
    .order("name");
  if (allowed.length > 0) plainQuery = plainQuery.in("name", allowed);
  const { data, error } = await plainQuery;
  if (error) throw error;
  return (data ?? []).map((l) => ({ ...l, municipalities: [] }));
}
