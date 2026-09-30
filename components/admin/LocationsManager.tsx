"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { createLocation, deleteLocation, updateLocation } from "@/lib/actions";

const DEFAULT_COUNTRY = "País";

type LocationRow = {
  id: string;
  name: string;
  country: string | null;
  slug: string;
};

export default function LocationsManager({
  rows,
  propertyCounts,
}: {
  rows: LocationRow[];
  propertyCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCountry, setEditCountry] = useState(DEFAULT_COUNTRY);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    const result = await action();
    if (!result.ok) {
      setError(result.error ?? "No se pudo completar la acción.");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await run(async () => {
      const result = await createLocation({
        name: name.trim(),
        country: country.trim() || DEFAULT_COUNTRY,
      });
      if (result.ok) {
        setName("");
        setCountry(DEFAULT_COUNTRY);
      }
      return result;
    });
  }

  function startEdit(l: LocationRow) {
    setConfirmDelete(null);
    setEditingId(l.id);
    setEditName(l.name);
    setEditCountry(l.country?.trim() || DEFAULT_COUNTRY);
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    await run(async () => {
      const result = await updateLocation({
        id,
        name: editName.trim(),
        country: editCountry.trim() || DEFAULT_COUNTRY,
      });
      if (result.ok) setEditingId(null);
      return result;
    });
  }

  return (
    <div className="max-w-2xl">
      {error && (
        <p
          role="alert"
          className="mb-4 bg-error-container text-on-error-container font-body-md text-body-md px-4 py-3 rounded"
        >
          {error}
        </p>
      )}

      <form
        onSubmit={onSubmit}
        className="flex flex-wrap gap-2 mb-6"
      >
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre de la ubicación"
          aria-label="Nombre de la nueva ubicación"
          className="bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder:text-secondary outline-none focus:border-primary flex-1 min-w-40"
        />
        <input
          type="text"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="País"
          aria-label="País de la nueva ubicación"
          className="bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder:text-secondary outline-none focus:border-primary flex-1 min-w-40"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-on-primary font-label-md text-label-md px-5 py-2.5 rounded hover:bg-primary-fixed-dim hover:text-on-primary-fixed transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          Agregar
        </button>
      </form>

      <ul className="bg-surface-container-low rounded-lg border border-outline-variant divide-y divide-outline-variant/60">
        {rows.length === 0 && (
          <li className="px-4 py-6 text-center font-body-md text-body-md text-secondary">
            Sin ubicaciones todavía.
          </li>
        )}
        {rows.map((l) => (
          <li
            key={l.id}
            className="px-4 py-3 flex items-center justify-between gap-3"
          >
            {editingId === l.id ? (
              <form
                className="flex flex-wrap items-center gap-2 min-w-0 flex-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveEdit(l.id);
                }}
              >
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  aria-label={`Editar nombre de ${l.name}`}
                  autoFocus
                  className="bg-surface rounded border border-outline-variant px-3 py-2 font-body-md text-body-md text-on-surface outline-none focus:border-primary flex-1 min-w-32"
                />
                <input
                  type="text"
                  value={editCountry}
                  onChange={(e) => setEditCountry(e.target.value)}
                  aria-label={`Editar país de ${l.name}`}
                  placeholder="País"
                  className="bg-surface rounded border border-outline-variant px-3 py-2 font-body-md text-body-md text-on-surface placeholder:text-secondary outline-none focus:border-primary flex-1 min-w-32"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="bg-primary text-on-primary font-label-sm text-label-sm px-2.5 py-1.5 rounded disabled:opacity-60"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="font-label-sm text-label-sm text-secondary px-2 py-1.5"
                >
                  Cancelar
                </button>
              </form>
            ) : (
              <>
                <div className="min-w-0">
                  <p className="font-label-md text-label-md text-on-surface truncate">
                    {l.name}
                    {l.country && (
                      <span className="text-secondary"> · {l.country}</span>
                    )}
                  </p>
                  <p className="font-label-sm text-label-sm text-secondary">
                    /{l.slug} · {propertyCounts[l.id] ?? 0} propiedad(es)
                  </p>
                </div>
                {confirmDelete === l.id ? (
                  <span className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setConfirmDelete(null);
                        run(() => deleteLocation(l.id));
                      }}
                      className="bg-error text-on-error font-label-sm text-label-sm px-2.5 py-1.5 rounded"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(null)}
                      className="font-label-sm text-label-sm text-secondary px-2 py-1.5"
                    >
                      Cancelar
                    </button>
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(l)}
                      aria-label={`Editar ubicación ${l.name}`}
                      className="p-1.5 rounded hover:bg-surface-container-high text-secondary hover:text-on-surface transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(l.id)}
                      aria-label={`Eliminar ubicación ${l.name}`}
                      className="p-1.5 rounded hover:bg-error-container text-secondary hover:text-on-error-container transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </span>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
