"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import PriceRangeSlider from "@/components/PriceRangeSlider";
import type { CatalogPriceBounds } from "@/lib/queries";

export type CatalogFilters = {
  q: string;
  op: string;
  tipo: string;
  ubi: string;
  pmin: string;
  pmax: string;
  hab: string;
  orden: string;
};

const fieldCls =
  "bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface";

function parseFilterPrice(raw: string, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Controles del catálogo: escriben los filtros en la URL (searchParams) y el
 *  servidor hace el filtrado/paginación en base de datos. */
export default function PropertyFilters({
  categories,
  locations,
  total,
  filters,
  priceBounds,
}: {
  categories: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  total: number;
  filters: CatalogFilters;
  priceBounds: CatalogPriceBounds;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(filters.q);
  const [prevQ, setPrevQ] = useState(filters.q);
  const skipFirstRender = useRef(true);

  if (filters.q !== prevQ) {
    setPrevQ(filters.q);
    setQ(filters.q);
  }

  const sliderMin = parseFilterPrice(filters.pmin, priceBounds.floor);
  const sliderMax = parseFilterPrice(filters.pmax, priceBounds.ceiling);

  function push(next: Partial<CatalogFilters>) {
    const merged = { ...filters, q, ...next };
    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.op) params.set("op", merged.op);
    if (merged.tipo) params.set("tipo", merged.tipo);
    if (merged.ubi) params.set("ubi", merged.ubi);
    if (merged.pmin) params.set("pmin", merged.pmin);
    if (merged.pmax) params.set("pmax", merged.pmax);
    if (merged.hab) params.set("hab", merged.hab);
    if (merged.orden && merged.orden !== "recientes") {
      params.set("orden", merged.orden);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Búsqueda con debounce para no recargar en cada tecla
  useEffect(() => {
    if (skipFirstRender.current) {
      skipFirstRender.current = false;
      return;
    }
    if (q === filters.q) return;
    const t = setTimeout(() => push({ q }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const handlePriceChange = useCallback(
    (min: number | null, max: number | null) => {
      push({
        pmin: min != null ? String(min) : "",
        pmax: max != null ? String(max) : "",
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters, q, pathname]
  );

  function clearAll() {
    setQ("");
    router.replace(pathname, { scroll: false });
  }

  const hasFilters = Boolean(
    filters.q ||
      filters.op ||
      filters.tipo ||
      filters.ubi ||
      filters.pmin ||
      filters.pmax ||
      filters.hab ||
      (filters.orden && filters.orden !== "recientes")
  );

  return (
    <div className="bg-surface-container-low rounded-lg p-4 md:p-6 mb-stack-lg">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="md:col-span-2 flex items-center gap-2 bg-surface rounded border border-outline-variant px-3">
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-secondary text-base"
          >
            search
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o ubicación…"
            aria-label="Buscar propiedades"
            className="w-full bg-transparent py-3 font-body-md text-body-md text-on-surface placeholder:text-secondary"
          />
        </div>

        <label className="flex flex-col">
          <span className="font-label-sm text-label-sm text-secondary mb-1">
            Operación
          </span>
          <select
            value={filters.op}
            onChange={(e) => push({ op: e.target.value })}
            className={fieldCls}
          >
            <option value="">Todas</option>
            <option value="venta">Venta</option>
            <option value="alquiler">Alquiler</option>
          </select>
        </label>

        <label className="flex flex-col">
          <span className="font-label-sm text-label-sm text-secondary mb-1">
            Tipo
          </span>
          <select
            value={filters.tipo}
            onChange={(e) => push({ tipo: e.target.value })}
            className={fieldCls}
          >
            <option value="">Todos</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col">
          <span className="font-label-sm text-label-sm text-secondary mb-1">
            Ubicación
          </span>
          <select
            value={filters.ubi}
            onChange={(e) => push({ ubi: e.target.value })}
            className={fieldCls}
          >
            <option value="">Todas</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col">
          <span className="font-label-sm text-label-sm text-secondary mb-1">
            Habitaciones
          </span>
          <select
            value={filters.hab}
            onChange={(e) => push({ hab: e.target.value })}
            className={fieldCls}
          >
            <option value="">Cualquiera</option>
            {["1", "2", "3", "4", "5"].map((b) => (
              <option key={b} value={b}>
                {b}+
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col">
          <span className="font-label-sm text-label-sm text-secondary mb-1">
            Ordenar por
          </span>
          <select
            value={filters.orden}
            onChange={(e) => push({ orden: e.target.value })}
            className={fieldCls}
          >
            <option value="recientes">Recientes</option>
            <option value="precio-asc">Precio: menor a mayor</option>
            <option value="precio-desc">Precio: mayor a menor</option>
          </select>
        </label>
      </div>

      <div className="mt-4 border-t border-outline-variant/60 pt-4">
        <PriceRangeSlider
          key={`${sliderMin}-${sliderMax}-${priceBounds.ceiling}`}
          floor={priceBounds.floor}
          ceiling={priceBounds.ceiling}
          valueMin={sliderMin}
          valueMax={sliderMax}
          onChange={handlePriceChange}
        />
      </div>

      <div className="flex justify-between items-center mt-4 flex-wrap gap-3">
        <p className="font-label-sm text-label-sm text-secondary" role="status">
          {total} propiedad{total !== 1 ? "es" : ""} encontrada
          {total !== 1 ? "s" : ""}
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1 min-h-[44px] px-3 font-label-sm text-label-sm text-secondary hover:text-primary transition-colors cursor-pointer"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-base">
              filter_alt_off
            </span>
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}
