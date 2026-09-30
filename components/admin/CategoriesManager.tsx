"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCategory, deleteCategory, updateCategory } from "@/lib/actions";

type CategoryRow = { id: string; name: string; slug: string };

export default function CategoriesManager({
  rows,
  propertyCounts,
}: {
  rows: CategoryRow[];
  propertyCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

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
      const result = await createCategory({ name: name.trim() });
      if (result.ok) setName("");
      return result;
    });
  }

  function startEdit(c: CategoryRow) {
    setConfirmDelete(null);
    setEditingId(c.id);
    setEditName(c.name);
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    await run(async () => {
      const result = await updateCategory({ id, name: editName.trim() });
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

      <form onSubmit={onSubmit} className="flex gap-2 mb-6">
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre de la categoría"
          aria-label="Nombre de la nueva categoría"
          className="bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder:text-secondary outline-none focus:border-primary flex-1"
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
            Sin categorías todavía.
          </li>
        )}
        {rows.map((c) => (
          <li
            key={c.id}
            className="px-4 py-3 flex items-center justify-between gap-3"
          >
            {editingId === c.id ? (
              <form
                className="flex items-center gap-2 min-w-0 flex-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveEdit(c.id);
                }}
              >
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  aria-label={`Editar nombre de ${c.name}`}
                  autoFocus
                  className="bg-surface rounded border border-outline-variant px-3 py-2 font-body-md text-body-md text-on-surface outline-none focus:border-primary flex-1 min-w-0"
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
                <Link
                  href={`/admin/categorias/${c.id}`}
                  className="min-w-0 flex-1"
                >
                  <p className="font-label-md text-label-md text-on-surface truncate hover:text-primary">
                    {c.name}
                  </p>
                  <p className="font-label-sm text-label-sm text-secondary">
                    /{c.slug} · {propertyCounts[c.id] ?? 0} propiedad(es)
                  </p>
                </Link>
                {confirmDelete === c.id ? (
                  <span className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setConfirmDelete(null);
                        run(() => deleteCategory(c.id));
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
                      onClick={() => startEdit(c)}
                      aria-label={`Editar categoría ${c.name}`}
                      className="p-1.5 rounded hover:bg-surface-container-high text-secondary hover:text-on-surface transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">
                        edit
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(c.id)}
                      aria-label={`Eliminar categoría ${c.name}`}
                      className="p-1.5 rounded hover:bg-error-container text-secondary hover:text-on-error-container transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">
                        delete
                      </span>
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
