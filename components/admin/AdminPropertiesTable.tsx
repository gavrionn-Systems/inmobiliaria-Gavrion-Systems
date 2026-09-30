"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { deleteProperty, setPropertyStatus, toggleFeatured } from "@/lib/actions";
import { formatPrice, formatDate } from "@/lib/format";

type PropertyRow = {
  id: string;
  code: string;
  title: string;
  slug: string;
  status: string;
  operation: string;
  price: number;
  currency: string;
  main_image_url: string | null;
  is_featured: boolean;
  created_at: string;
  categories: { name: string } | null;
  locations: { name: string } | null;
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  publicada: { label: "Publicada", cls: "bg-primary-container text-on-primary-container" },
  borrador: { label: "Borrador", cls: "bg-surface-container-highest text-secondary" },
  vendida: { label: "Vendida", cls: "bg-secondary text-on-secondary" },
  archivada: { label: "Archivada", cls: "bg-surface-variant text-on-surface-variant" },
};

export default function AdminPropertiesTable({ rows }: { rows: PropertyRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "No se pudo completar la acción.");
      return;
    }
    startTransition(() => router.refresh());
  }

  if (rows.length === 0) {
    return (
      <div className="bg-surface-container-low rounded-lg border border-dashed border-outline-variant p-10 text-center">
        <span className="material-symbols-outlined text-4xl text-primary mb-3">
          add_home
        </span>
        <h2 className="font-headline-md text-headline-md text-on-surface mb-2">
          Todavía no hay propiedades
        </h2>
        <p className="font-body-md text-body-md text-secondary mb-6 max-w-md mx-auto">
          Cree la primera propiedad con el botón &quot;Nueva Propiedad&quot;.
          Queda en borrador hasta que la publique; el sitio público solo muestra
          fichas en estado Publicada.
        </p>
        <Link
          href="/admin/propiedades/nueva"
          className="bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded inline-flex items-center gap-2 hover:bg-primary-fixed-dim hover:text-on-primary-fixed transition-colors"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Nueva Propiedad
        </Link>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <p
          role="alert"
          className="mb-4 bg-error-container text-on-error-container font-body-md text-body-md px-4 py-3 rounded"
        >
          {error}
        </p>
      )}

      <p className="md:hidden mb-2 font-label-sm text-label-sm text-secondary flex items-center gap-1">
        <span aria-hidden="true" className="material-symbols-outlined text-sm">
          swipe_right
        </span>
        Desliza para ver más columnas
      </p>
      <div className="bg-surface-container-low rounded-lg border border-outline-variant overflow-x-auto custom-scrollbar">
        <table className="w-full min-w-[860px] text-left">
          <thead>
            <tr className="border-b border-outline-variant">
              {["Propiedad", "Precio", "Estado", "Destacada", "Creada", ""].map(
                (h, i) => (
                  <th
                    key={i}
                    className="px-4 py-3 font-label-sm text-label-sm text-secondary uppercase tracking-wider"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const status = STATUS_LABELS[p.status] ?? STATUS_LABELS.borrador;
              return (
                <tr
                  key={p.id}
                  className="border-b border-outline-variant/60 last:border-b-0 hover:bg-surface-container-lowest transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-16 h-12 rounded overflow-hidden flex-shrink-0 bg-surface-container-high">
                        {p.main_image_url && (
                          <Image
                            src={p.main_image_url}
                            alt=""
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/admin/propiedades/${p.id}/editar`}
                          className="font-label-md text-label-md text-on-surface hover:text-primary truncate block"
                        >
                          {p.title}
                        </Link>
                        <p className="font-label-sm text-label-sm text-secondary truncate">
                          {p.code} · {p.categories?.name ?? "Sin categoría"} ·{" "}
                          {p.locations?.name ?? "Sin ubicación"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-body-md text-body-md text-on-surface whitespace-nowrap">
                    {formatPrice(p.price, p.currency, p.operation)}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={p.status}
                      disabled={busy}
                      onChange={(e) =>
                        run(() => setPropertyStatus(p.id, e.target.value))
                      }
                      className={`font-label-sm text-label-sm px-2 py-2 rounded border border-outline-variant ${status.cls}`}
                      aria-label={`Estado de ${p.title}`}
                    >
                      {Object.entries(STATUS_LABELS).map(([value, s]) => (
                        <option key={value} value={value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(() => toggleFeatured(p.id, !p.is_featured))
                      }
                      aria-pressed={p.is_featured}
                      aria-label={
                        p.is_featured
                          ? `Quitar ${p.title} de destacadas`
                          : `Destacar ${p.title}`
                      }
                      className="p-2 rounded hover:bg-surface-container-high transition-colors disabled:opacity-50"
                    >
                      <span
                        className="material-symbols-outlined text-on-surface"
                        style={
                          p.is_featured
                            ? { color: "var(--color-primary)", fontVariationSettings: "'FILL' 1" }
                            : undefined
                        }
                      >
                        star
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3 font-label-sm text-label-sm text-secondary whitespace-nowrap">
                    {formatDate(p.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link
                        href={`/admin/propiedades/${p.id}/editar`}
                        aria-label={`Editar ${p.title}`}
                        className="p-2.5 rounded hover:bg-surface-container-high text-secondary hover:text-primary transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">
                          edit
                        </span>
                      </Link>
                      {confirmDelete === p.id ? (
                        <span className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setConfirmDelete(null);
                              run(() => deleteProperty(p.id));
                            }}
                            className="bg-error text-on-error font-label-sm text-label-sm px-3 py-2 rounded"
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            className="font-label-sm text-label-sm text-secondary px-3 py-2"
                          >
                            Cancelar
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(p.id)}
                          aria-label={`Eliminar ${p.title}`}
                          className="p-2.5 rounded hover:bg-error-container text-secondary hover:text-on-error-container transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">
                            delete
                          </span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}