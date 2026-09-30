import type { CatalogParams, CatalogSort } from "@/lib/queries";

export type CatalogFilters = {
  q: string;
  op: string;
  tipo: string;
  ubi: string;
  muni: string;
  pmin: string;
  pmax: string;
  hab: string;
  orden: string;
};

export const SORTS = new Set<CatalogSort>(["recientes", "precio-asc", "precio-desc"]);
export const BEDS = new Set(["1", "2", "3", "4", "5"]);
export const OPS = new Set(["venta", "alquiler"]);

export const DEFAULT_CATALOG_FILTERS: CatalogFilters = {
  q: "",
  op: "",
  tipo: "",
  ubi: "",
  muni: "",
  pmin: "",
  pmax: "",
  hab: "",
  orden: "recientes",
};

export function parsePositive(raw: string): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function parseCatalogSearchParams(
  sp: Record<string, string | string[] | undefined>
): CatalogFilters & { pagina: number } {
  const str = (v: string | string[] | undefined) =>
    typeof v === "string" ? v.trim() : "";
  const q = str(sp.q);
  const opRaw = str(sp.op);
  const op = OPS.has(opRaw) ? opRaw : "";
  const tipo = str(sp.tipo);
  const ubi = str(sp.ubi);
  const muni = str(sp.muni);
  const pmin = str(sp.pmin);
  const pmax = str(sp.pmax);
  const habRaw = str(sp.hab);
  const hab = BEDS.has(habRaw) ? habRaw : "";
  const ordenRaw = str(sp.orden) as CatalogSort;
  const orden: CatalogSort = SORTS.has(ordenRaw) ? ordenRaw : "recientes";
  const pagina = Math.max(1, Number.parseInt(str(sp.pagina), 10) || 1);
  return { q, op, tipo, ubi, muni, pmin, pmax, hab, orden, pagina };
}

export function catalogFiltersToParams(filters: CatalogFilters): CatalogParams {
  return {
    q: filters.q || undefined,
    operation: filters.op ? (filters.op as "venta" | "alquiler") : undefined,
    categoryId: filters.tipo || undefined,
    locationId: filters.ubi || undefined,
    municipality: filters.muni || undefined,
    minPrice: parsePositive(filters.pmin),
    maxPrice: parsePositive(filters.pmax),
    minBeds: filters.hab ? Number(filters.hab) : undefined,
    sort: (SORTS.has(filters.orden as CatalogSort) ? filters.orden : "recientes") as CatalogSort,
  };
}

export function buildCatalogQuery(
  filters: CatalogFilters,
  extra?: { pagina?: number }
): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.op) params.set("op", filters.op);
  if (filters.tipo) params.set("tipo", filters.tipo);
  if (filters.ubi) params.set("ubi", filters.ubi);
  if (filters.muni) params.set("muni", filters.muni);
  if (filters.pmin) params.set("pmin", filters.pmin);
  if (filters.pmax) params.set("pmax", filters.pmax);
  if (filters.hab) params.set("hab", filters.hab);
  if (filters.orden && filters.orden !== "recientes") params.set("orden", filters.orden);
  if (extra?.pagina && extra.pagina > 1) params.set("pagina", String(extra.pagina));
  const qs = params.toString();
  return qs ? `/propiedades?${qs}` : "/propiedades";
}

export function hasActiveFilters(filters: CatalogFilters): boolean {
  return Boolean(
    filters.q ||
      filters.op ||
      filters.tipo ||
      filters.ubi ||
      filters.muni ||
      filters.pmin ||
      filters.pmax ||
      filters.hab ||
      (filters.orden && filters.orden !== "recientes")
  );
}

export function catalogPageHref(filters: CatalogFilters, page: number): string {
  return buildCatalogQuery(filters, { pagina: page });
}
