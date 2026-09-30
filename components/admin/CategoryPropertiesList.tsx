import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  publicada: {
    label: "Publicada",
    cls: "bg-primary-container text-on-primary-container",
  },
  borrador: {
    label: "Borrador",
    cls: "bg-surface-container-highest text-secondary",
  },
  vendida: { label: "Vendida", cls: "bg-secondary text-on-secondary" },
  archivada: {
    label: "Archivada",
    cls: "bg-surface-variant text-on-surface-variant",
  },
};

export type CategoryPropertyRow = {
  id: string;
  title: string;
  status: string;
  price: number;
  currency: string;
  operation: string;
  main_image_url: string | null;
};

export default function CategoryPropertiesList({
  properties,
}: {
  properties: CategoryPropertyRow[];
}) {
  if (properties.length === 0) {
    return (
      <div className="bg-surface-container-low rounded-lg border border-dashed border-outline-variant p-10 text-center">
        <p className="font-body-md text-body-md text-secondary">
          No hay propiedades en esta categoría.
        </p>
      </div>
    );
  }

  return (
    <ul className="bg-surface-container-low rounded-lg border border-outline-variant divide-y divide-outline-variant/60">
      {properties.map((p) => {
        const status = STATUS_LABELS[p.status] ?? STATUS_LABELS.borrador;
        return (
          <li key={p.id} className="px-5 py-3 flex items-center gap-3">
            <div className="relative w-16 h-12 rounded overflow-hidden flex-shrink-0 bg-surface-container-high">
              {p.main_image_url ? (
                <Image
                  src={p.main_image_url}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-label-md text-label-md text-on-surface truncate">
                {p.title}
              </p>
              <p className="font-label-sm text-label-sm text-secondary">
                {formatPrice(p.price, p.currency, p.operation)}
              </p>
            </div>
            <span
              className={`font-label-sm text-label-sm px-2 py-1 rounded flex-shrink-0 ${status.cls}`}
            >
              {status.label}
            </span>
            <Link
              href={`/admin/propiedades/${p.id}/editar`}
              className="flex-shrink-0 bg-primary text-on-primary font-label-sm text-label-sm px-3 py-1.5 rounded hover:bg-primary-fixed-dim hover:text-on-primary-fixed transition-colors"
            >
              Editar
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
