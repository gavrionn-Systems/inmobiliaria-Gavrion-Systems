"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import PriceRangeSlider from "@/components/PriceRangeSlider";
import type { CatalogPriceBounds } from "@/lib/queries";
import type { CatalogFilters } from "@/lib/catalog-params";
import { hasActiveFilters } from "@/lib/catalog-params";
import { LOCATION_MUNICIPALITIES, municipalitiesFor } from "@/lib/location-options";

const fieldCls =
  "w-full min-h-11 bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant";
const fieldClsCatalog =
  "min-h-11 bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant";

function parseFilterPrice(raw: string, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

type Props = {
  categories: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  priceBounds: CatalogPriceBounds;
  filters: CatalogFilters;
  total?: number;
  variant: "hero" | "catalog";
  searchDebounceMs?: number;
  priceSliderDebounceMs?: number;
};

export default function CatalogSearch({
  categories,
  locations,
  priceBounds,
  filters,
  total,
  variant,
  searchDebounceMs = 350,
  priceSliderDebounceMs = 300,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const isCatalog = variant === "catalog";

  // q handling: controlled with debounce in catalog, immediate state in hero
  const [q, setQ] = useState(filters.q);
  const [prevQ, setPrevQ] = useState(filters.q);
  const skipFirstRender = useRef(true);

  if (filters.q !== prevQ) {
    setPrevQ(filters.q);
    setQ(filters.q);
  }

  const sliderMin = parseFilterPrice(filters.pmin, priceBounds.floor);
  const sliderMax = parseFilterPrice(filters.pmax, priceBounds.ceiling);

  const push = useCallback(
    (next: Partial<CatalogFilters> & { q?: string }) => {
      const merged: CatalogFilters = {
        ...filters,
        q,
        ...next,
      };
      // allow q override via next.q
      if (next.q !== undefined) merged.q = next.q;
      // si cambia departamento, limpiar municipio si ya no pertenece
      if (next.ubi !== undefined && next.muni === undefined) {
        const deptName = locations.find((l) => l.id === (next.ubi as string))?.name ?? "";
        const valid = deptName ? municipalitiesFor(deptName) : [];
        if (valid.length && merged.muni && !valid.includes(merged.muni)) {
          merged.muni = "";
        }
        if (!deptName && !next.ubi) {
          // no dept, muni se mantiene (usuario elige cualquiera)
        }
      }
      const params = new URLSearchParams();
      if (merged.q) params.set("q", merged.q);
      if (merged.op) params.set("op", merged.op);
      if (merged.tipo) params.set("tipo", merged.tipo);
      if (merged.ubi) params.set("ubi", merged.ubi);
      if (merged.muni) params.set("muni", merged.muni);
      if (merged.pmin) params.set("pmin", merged.pmin);
      if (merged.pmax) params.set("pmax", merged.pmax);
      if (merged.hab) params.set("hab", merged.hab);
      if (merged.orden && merged.orden !== "recientes") params.set("orden", merged.orden);
      const qs = params.toString();
      const href = qs ? `/propiedades?${qs}` : "/propiedades";
      if (isCatalog) {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      } else {
        router.push(href);
      }
    },
    [filters, q, pathname, router, isCatalog]
  );

  // debounce for catalog q — configurable desde Admin (perf: INP)
  useEffect(() => {
    if (!isCatalog) return;
    if (skipFirstRender.current) {
      skipFirstRender.current = false;
      return;
    }
    if (q === filters.q) return;
    const t = setTimeout(() => push({ q }), searchDebounceMs);
    return () => clearTimeout(t);
  }, [q, filters.q, push, isCatalog, searchDebounceMs]);

  const handlePriceChange = useCallback(
    (min: number | null, max: number | null) => {
      push({
        pmin: min != null ? String(min) : "",
        pmax: max != null ? String(max) : "",
      });
    },
    [push]
  );

  function onHeroSubmit(e: React.FormEvent) {
    e.preventDefault();
    push({});
  }

  function clearAll() {
    setQ("");
    if (isCatalog) router.replace(pathname, { scroll: false });
    else router.push("/propiedades");
  }

  const showClear = hasActiveFilters(filters) || (isCatalog && q !== "");

  const selectCls = isCatalog ? fieldClsCatalog : fieldCls;
  const deptNameForMuni = locations.find((l) => l.id === filters.ubi)?.name ?? "";
  const muniOptions = deptNameForMuni
    ? municipalitiesFor(deptNameForMuni)
    : ([...new Set(Object.values(LOCATION_MUNICIPALITIES).flat())].sort((a, b) =>
        a.localeCompare(b, "es"),
      ) as string[]);

  function renderOperationSelect() {
    return (
      <label className="flex flex-col gap-1">
        <span className="font-label-sm text-label-sm text-secondary">Operación</span>
        <select
          value={filters.op}
          onChange={(e) => push({ op: e.target.value })}
          className={selectCls}
        >
          <option value="">{isCatalog ? "Todas" : "Comprar o rentar"}</option>
          <option value="venta">{isCatalog ? "Venta" : "Comprar"}</option>
          <option value="alquiler">{isCatalog ? "Alquiler" : "Rentar"}</option>
        </select>
      </label>
    );
  }

  function renderTipoSelect() {
    return (
      <label className="flex flex-col gap-1">
        <span className="font-label-sm text-label-sm text-secondary">Tipo</span>
        <select
          value={filters.tipo}
          onChange={(e) => push({ tipo: e.target.value })}
          className={selectCls}
        >
          <option value="">{isCatalog ? "Todos" : "Cualquier tipo"}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
    );
  }

  function renderUbiSelect() {
    return (
      <label className="flex flex-col gap-1">
        <span className="font-label-sm text-label-sm text-secondary">Ubicación (depto.)</span>
        <select
          value={filters.ubi}
          onChange={(e) => push({ ubi: e.target.value })}
          className={selectCls}
        >
          <option value="">Todos</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </label>
    );
  }

  function renderMuniSelect() {
    return (
      <label className="flex flex-col gap-1">
        <span className="font-label-sm text-label-sm text-secondary">Municipio</span>
        <select
          value={filters.muni}
          onChange={(e) => push({ muni: e.target.value })}
          className={selectCls}
        >
          <option value="">Todos</option>
          {muniOptions.slice(0, 120).map((m) => (
            <option key={`${deptNameForMuni || "all"}-${m}`} value={m}>
              {m}
            </option>
          ))}
          {filters.muni && !muniOptions.includes(filters.muni) && (
            <option value={filters.muni}>{filters.muni}</option>
          )}
        </select>
      </label>
    );
  }

  function renderHabSelect() {
    return (
      <label className="flex flex-col gap-1">
        <span className="font-label-sm text-label-sm text-secondary">Habitaciones</span>
        <select
          value={filters.hab}
          onChange={(e) => push({ hab: e.target.value })}
          className={selectCls}
        >
          <option value="">Cualquiera</option>
          {["1", "2", "3", "4", "5"].map((b) => (
            <option key={b} value={b}>
              {b}+
            </option>
          ))}
        </select>
      </label>
    );
  }

  function renderOrdenSelect() {
    return (
      <label className="flex flex-col gap-1">
        <span className="font-label-sm text-label-sm text-secondary">Ordenar por</span>
        <select
          value={filters.orden || "recientes"}
          onChange={(e) => push({ orden: e.target.value })}
          className={selectCls}
        >
          <option value="recientes">Recientes</option>
          <option value="precio-asc">Precio: menor a mayor</option>
          <option value="precio-desc">Precio: mayor a menor</option>
        </select>
      </label>
    );
  }

  if (isCatalog) {
    return (
      <div className="bg-surface-container-low rounded-lg p-4 md:p-6 mb-stack-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="md:col-span-2 flex items-center gap-2 bg-surface rounded border border-outline-variant px-3">
            <span aria-hidden="true" className="material-symbols-outlined text-secondary text-base">
              search
            </span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o ubicación…"
              aria-label="Buscar propiedades"
              className="w-full min-h-11 bg-transparent py-3 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none"
            />
          </div>
          {renderOperationSelect()}
          {renderTipoSelect()}
          {renderUbiSelect()}
          {renderMuniSelect()}
          {renderHabSelect()}
          {renderOrdenSelect()}
        </div>

        <div className="mt-4 border-t border-outline-variant/60 pt-4">
          <PriceRangeSlider
            key={`${sliderMin}-${sliderMax}-${priceBounds.ceiling}-${priceBounds.step}`}
            floor={priceBounds.floor}
            ceiling={priceBounds.ceiling}
            step={priceBounds.step}
            valueMin={sliderMin}
            valueMax={sliderMax}
            debounceMs={priceSliderDebounceMs}
            onChange={handlePriceChange}
          />
        </div>

        <div className="flex justify-between items-center mt-4 flex-wrap gap-3">
          {typeof total === "number" ? (
            <p className="font-label-sm text-label-sm text-secondary" role="status">
              {total} propiedad{total !== 1 ? "es" : ""} encontrada{total !== 1 ? "s" : ""}
            </p>
          ) : (
            <span />
          )}
          {showClear && (
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

  const sliderKey = `${sliderMin}-${sliderMax}-${priceBounds.ceiling}-${priceBounds.step}`;
  function renderPriceSlider(instance: string) {
    return (
      <PriceRangeSlider
        key={`${sliderKey}-${instance}`}
        floor={priceBounds.floor}
        ceiling={priceBounds.ceiling}
        step={priceBounds.step}
        valueMin={sliderMin}
        valueMax={sliderMax}
        debounceMs={priceSliderDebounceMs}
        onChange={handlePriceChange}
      />
    );
  }

  // hero variant
  return (
    <form
      onSubmit={onHeroSubmit}
      className="mt-6 md:mt-8 max-w-3xl bg-surface rounded-lg p-4 md:p-5 border border-outline-variant"
      aria-label="Buscar propiedades"
    >
      <div className="flex items-center gap-2 bg-surface rounded border border-outline-variant px-3 mb-3">
        <span aria-hidden="true" className="material-symbols-outlined text-secondary text-base">
          search
        </span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o ubicación…"
          aria-label="Buscar propiedades"
          className="w-full min-h-11 bg-transparent py-3 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none"
        />
      </div>

      <div className="md:hidden mb-3">{renderOperationSelect()}</div>

      <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-3">
        {renderOperationSelect()}
        {renderTipoSelect()}
        {renderUbiSelect()}
        {renderMuniSelect()}
        {renderHabSelect()}
        {renderOrdenSelect()}
      </div>

      <div className="hidden md:block mt-4 border-t border-outline-variant/60 pt-4">
        {renderPriceSlider("wide")}
      </div>

      <details className="md:hidden border-t border-outline-variant/60 pt-1">
        <summary className="min-h-11 flex items-center gap-2 cursor-pointer font-label-md text-label-md text-on-surface list-none [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="material-symbols-outlined text-base">
            tune
          </span>
          Más filtros
        </summary>
        <div className="grid grid-cols-1 gap-3 pt-2">
          {renderTipoSelect()}
          {renderUbiSelect()}
          {renderMuniSelect()}
          {renderHabSelect()}
          {renderOrdenSelect()}
        </div>
        <div className="mt-3">{renderPriceSlider("narrow")}</div>
      </details>

      <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          type="submit"
          className="min-h-11 w-full sm:w-auto bg-primary-container text-on-primary-container font-label-md text-label-md px-8 py-3 rounded hover:bg-primary hover:text-on-primary transition-colors cursor-pointer"
        >
          Buscar propiedades
        </button>
        <p className="font-label-sm text-label-sm text-on-surface-variant">
          Filtre por operación, tipo, zona y presupuesto.
        </p>
        {showClear && (
          <button
            type="button"
            onClick={clearAll}
            className="sm:ml-auto inline-flex items-center justify-center gap-1 min-h-11 px-3 font-label-sm text-label-sm text-on-surface-variant hover:text-primary cursor-pointer"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-base">
              filter_alt_off
            </span>
            Limpiar
          </button>
        )}
      </div>
    </form>
  );
}
