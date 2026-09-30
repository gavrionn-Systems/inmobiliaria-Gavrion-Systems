import Image from "next/image";
import Link from "next/link";
import type { PropertySummary } from "@/lib/properties";

const STATUS_BADGES = {
  disponible: {
    label: "Disponible",
    className:
      "bg-primary-fixed-dim/90 text-on-primary-fixed border border-primary-container",
  },
  destacado: {
    label: "DESTACADO",
    className: "bg-primary-container/90 text-on-primary-fixed",
  },
  vendido: {
    label: "VENDIDO",
    className: "bg-secondary/90 text-on-secondary",
  },
} as const;

export default function PropertyCard({
  property,
  variant = "standard",
  priority = false,
  quality = 75,
}: {
  property: PropertySummary;
  variant?: "large" | "standard" | "catalog";
  priority?: boolean;
  quality?: number;
}) {
  const isLarge = variant === "large";
  const isCatalog = variant === "catalog";
  const sold = property.status === "vendido";
  const badge = STATUS_BADGES[property.status];

  return (
    <Link
      href={`/propiedades/${property.id}`}
      className={`bg-surface-container-lowest rounded-lg border border-outline-variant overflow-hidden hover-lift image-scale-hover group flex flex-col ${
        sold ? "opacity-75 grayscale-[20%]" : ""
      } ${isCatalog ? "property-card-hover" : ""}`}
      aria-label={`Ver detalles de ${property.title}`}
    >
      <div
        className={`relative overflow-hidden ${
          isCatalog
            ? "w-full aspect-video"
            : `w-full ${isLarge ? "h-64 md:h-80" : "h-48"}`
        }`}
      >
        <Image
          src={property.image}
          alt={property.imageAlt}
          fill
          priority={priority}
          quality={quality}
          sizes={
            isLarge
              ? "(max-width: 768px) 100vw, 66vw"
              : "(max-width: 768px) 100vw, 33vw"
          }
          className="object-cover"
        />
        <div
          className={`absolute top-3 left-3 backdrop-blur-sm px-3 py-1 rounded font-label-sm text-label-sm uppercase tracking-wider ${badge.className}`}
        >
          {badge.label}
        </div>
      </div>

      <div
        className={`p-4 flex flex-col flex-grow ${isLarge ? "p-6 md:p-6" : ""}`}
      >
        <div className="flex justify-between items-start mb-2">
          <h3
            className={`${
              isLarge ? "font-headline-md text-headline-md" : "font-semibold text-lg leading-tight"
            } text-on-surface line-clamp-1 group-hover:text-primary transition-colors ${
              sold ? "text-secondary" : ""
            }`}
          >
            {property.title}
          </h3>
        </div>

        <p className="font-body-md text-body-md text-secondary mb-4 flex items-center gap-1 line-clamp-1 text-sm">
          <span aria-hidden="true" className="material-symbols-outlined text-sm">
            location_on
          </span>
          {property.location}
        </p>

        <div className="mt-auto">
          <div
            className={`flex items-center gap-4 py-3 border-t border-b border-surface-variant mb-4 ${
              isLarge ? "gap-6" : ""
            } flex-wrap`}
          >
            {property.bedrooms !== undefined && (
              <div className="flex items-center gap-1 text-secondary font-label-sm text-label-sm">
                <span aria-hidden="true" className="material-symbols-outlined text-base">bed</span>
                {property.bedrooms}
                <span className="sr-only">habitaciones</span>
              </div>
            )}
            {property.bathrooms !== undefined && (
              <div className="flex items-center gap-1 text-secondary font-label-sm text-label-sm">
                <span aria-hidden="true" className="material-symbols-outlined text-base">
                  shower
                </span>
                {property.bathrooms}
                <span className="sr-only">baños</span>
              </div>
            )}
            {property.area !== undefined && (
              <div className="flex items-center gap-1 text-secondary font-label-sm text-label-sm">
                <span aria-hidden="true" className="material-symbols-outlined text-base">
                  square_foot
                </span>
                {property.area} m2
                <span className="sr-only">de área</span>
              </div>
            )}
            {property.type && (
              <div className="flex items-center gap-1 text-secondary font-label-sm text-label-sm">
                <span aria-hidden="true" className="material-symbols-outlined text-base">
                  business
                </span>
                {property.type}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center flex-wrap gap-x-3">
            <span
              className={`font-headline-md ${
                isLarge ? "text-headline-md" : "font-bold text-lg md:text-headline-md"
              } ${sold ? "text-secondary line-through" : "text-on-surface"}`}
            >
              {property.price}
              {property.priceSuffix}
            </span>
            {!sold && (
              <span className="font-label-md text-label-md text-primary hover:text-on-primary-container transition-colors font-bold">
                Detalles
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}