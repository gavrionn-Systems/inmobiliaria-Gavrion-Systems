import { LOCATION_MUNICIPALITIES, municipalitiesFor } from "@/lib/location-options";
import { LOCATION_OPTIONS } from "@/lib/property-schema";

/**
 * Departamento (fila de `locations`) con sus municipios leídos de la tabla
 * `municipalities`. Se usa en el formulario del admin y en los filtros
 * públicos. Si la BD aún no tiene datos, se usa el catálogo estático de
 * lib/location-options.ts como respaldo.
 */
export type LocationOption = {
  id: string;
  name: string;
  municipalities?: string[];
};

const sortEs = (a: string, b: string) => a.localeCompare(b, "es");

/** Nombres de departamento a mostrar: los de la BD más los estáticos, para
 *  que la lista nunca quede incompleta si la BD aún no tiene los 18. */
export function departmentNames(locations?: LocationOption[]): string[] {
  const names = [...(locations ?? []).map((l) => l.name), ...LOCATION_OPTIONS];
  return [...new Set(names)].sort(sortEs);
}

/** Municipios del departamento: primero BD, luego respaldo estático. */
export function municipalitiesOf(
  locations: LocationOption[] | undefined,
  departmentName: string
): string[] {
  if (!departmentName) return [];
  const fromDb = locations?.find((l) => l.name === departmentName)?.municipalities ?? [];
  if (fromDb.length > 0) return [...fromDb].sort(sortEs);
  return municipalitiesFor(departmentName);
}

/** Todos los municipios (sin repetir), para cuando no hay departamento elegido. */
export function allMunicipalities(locations?: LocationOption[]): string[] {
  const fromDb = (locations ?? []).flatMap((l) => l.municipalities ?? []);
  const source = fromDb.length > 0 ? fromDb : Object.values(LOCATION_MUNICIPALITIES).flat();
  return [...new Set(source)].sort(sortEs);
}
