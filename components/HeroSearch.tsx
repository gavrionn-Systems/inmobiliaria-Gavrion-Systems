"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

/** Buscador del hero: redirige al catálogo con los filtros elegidos. */
export default function HeroSearch({
  categories,
  locations,
}: {
  categories: { id: string; name: string }[];
  locations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [operation, setOperation] = useState("");
  const [tipo, setTipo] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [precioMin, setPrecioMin] = useState("");
  const [precioMax, setPrecioMax] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (operation) params.set("op", operation);
    if (tipo) params.set("tipo", tipo);
    if (ubicacion) params.set("ubi", ubicacion);
    if (precioMin) params.set("pmin", precioMin);
    if (precioMax) params.set("pmax", precioMax);
    const qs = params.toString();
    router.push(qs ? `/propiedades?${qs}` : "/propiedades");
  }

  const fieldCls =
    "w-full bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface";

  return (
    <form
      onSubmit={onSubmit}
      className="mt-8 max-w-3xl bg-surface/95 backdrop-blur-sm rounded-lg p-4 md:p-5 shadow-sm border border-outline-variant/40"
      aria-label="Buscar propiedades"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-secondary">
            Operación
          </span>
          <select
            value={operation}
            onChange={(e) => setOperation(e.target.value)}
            className={fieldCls}
          >
            <option value="">Comprar o rentar</option>
            <option value="venta">Comprar</option>
            <option value="alquiler">Rentar</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-secondary">
            Tipo
          </span>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className={fieldCls}
          >
            <option value="">Cualquier tipo</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-secondary">
            Ubicación
          </span>
          <select
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
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

        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-secondary">
            Precio mín. (USD)
          </span>
          <input
            type="number"
            min={0}
            step={1000}
            inputMode="numeric"
            value={precioMin}
            onChange={(e) => setPrecioMin(e.target.value)}
            placeholder="Sin mínimo"
            className={fieldCls}
          />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-2">
          <span className="font-label-sm text-label-sm text-secondary">
            Precio máx. (USD)
          </span>
          <input
            type="number"
            min={0}
            step={1000}
            inputMode="numeric"
            value={precioMax}
            onChange={(e) => setPrecioMax(e.target.value)}
            placeholder="Sin límite"
            className={fieldCls}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          type="submit"
          className="bg-primary-container text-on-primary-container font-label-md text-label-md px-8 py-3 rounded hover:bg-primary hover:text-on-primary transition-colors cursor-pointer"
        >
          Buscar propiedades
        </button>
        <p className="font-label-sm text-label-sm text-secondary">
          Filtre por operación, tipo, zona y presupuesto.
        </p>
      </div>
    </form>
  );
}
