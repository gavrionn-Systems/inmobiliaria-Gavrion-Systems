import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import PropertyGallery from "@/components/PropertyGallery";
import { images } from "@/lib/properties";
import { formatPrice } from "@/lib/format";
import { getPropertyBySlug, getRelatedProperties } from "@/lib/queries";
import { getMapEmbedUrl, isMapsLink } from "@/lib/map-embed";
import { site } from "@/lib/site";
import { getSiteSettings } from "@/lib/site-settings";

export const revalidate = 60;

interface DetailPageProps {
  params: Promise<{ id: string }>;
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1).trimEnd() + "…";
}

export async function generateMetadata({
  params,
}: DetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const [property, settings] = await Promise.all([getPropertyBySlug(id), getSiteSettings()]);
  if (!property) return { title: "Propiedad no encontrada", robots: { index: false, follow: false } };
  const base = settings.url.replace(/\/$/, "");
  const canonical = `${base}/propiedades/${property.slug}`;
  const priceLabel = formatPrice(property.price, property.currency, property.operation);
  const descRaw = `${priceLabel} — ${property.locations?.name ?? "Consulte la ubicación"}. ${property.description?.split("\n\n")[0] ?? ""}`;
  const description = truncate(descRaw, 155);
  const title = `${property.title} | ${settings.name}`;
  const img = property.main_image_url ?? property.property_images[0]?.url ?? settings.heroImageUrl;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "article",
      images: [{ url: img, width: 1200, height: 630, alt: property.title }],
      locale: "es_HN",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [img],
    },
  };
}

export default async function PropertyDetailPage({
  params,
}: DetailPageProps) {
  const { id } = await params;
  const [property, settings] = await Promise.all([
    getPropertyBySlug(id),
    getSiteSettings(),
  ]);
  if (!property) notFound();

  const agentName =
    settings.defaultAgentName.trim() ||
    settings.name.trim() ||
    "Contactar inmobiliaria";
  const agentRole =
    settings.defaultAgentRole.trim() ||
    (settings.phone.trim() ? settings.phone : "Inmobiliaria");
  const agentPhone = settings.phone.trim();
  const agentEmail = settings.email.trim();
  const agentWhatsapp = settings.whatsapp.trim();
  const telHref = agentPhone.replace(/[^0-9+]/g, "");

  const gallery = [...(property.property_images ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order
  );
  const allImages =
    gallery.length > 0
      ? gallery
      : [{ url: property.main_image_url ?? images.hero, alt_text: property.title, sort_order: 0 }];
  const [main] = allImages;

  const mapEmbedUrl = await getMapEmbedUrl(property.map_image_url);
  const mapImageUrl =
    property.map_image_url && !isMapsLink(property.map_image_url)
      ? property.map_image_url
      : property.main_image_url ?? images.hero;

  const construction = Number(property.construction_area_m2 ?? 0);
  const pricePerM2 =
    construction > 0 && property.price > 0
      ? `$${Math.round(Number(property.price) / construction).toLocaleString(
          "es"
        )} / m²`
      : null;

  const descriptionParagraphs = property.description
    ? property.description.split("\n\n")
    : [];

  const related = await getRelatedProperties(
    property.location_id,
    property.category_id,
    property.id
  );

  return (
    <>
    <section className="pt-24 pb-stack-lg max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
      <PropertyGallery
        title={property.title}
        quality={settings.imageQuality}
        images={allImages.map((image) => ({
          url: image.url,
          alt_text: image.alt_text,
        }))}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        {/* Contenido principal */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <span className="bg-primary-container text-on-primary-container font-label-sm text-label-sm uppercase tracking-wider px-3 py-1 rounded">
              {property.operation === "venta" ? "En Venta" : "En Alquiler"}
            </span>
            <span className="font-label-sm text-label-sm text-secondary">
              {property.code ?? ""}
            </span>
          </div>

          <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2">
            {property.title}
          </h1>
          <p className="font-body-md text-body-md text-secondary flex items-center gap-1 mb-6">
            <span aria-hidden="true" className="material-symbols-outlined text-base">
              location_on
            </span>
            {(property as unknown as { municipality?: string }).municipality
              ? `${(property as unknown as { municipality?: string }).municipality}, ${property.locations?.name ?? ""}`
              : property.locations?.name ?? "Consulte la ubicación"}
            {property.address ? ` · ${property.address}` : ""}
          </p>

          <div className="flex items-end flex-wrap gap-4 mb-6">
            <div>
              <p className="font-headline-md text-headline-md text-on-surface">
                {formatPrice(property.price, property.currency, property.operation)}
              </p>
              {pricePerM2 && (
                <p className="font-label-sm text-label-sm text-secondary">
                  {pricePerM2}
                </p>
              )}
            </div>
          </div>

          {/* Especificaciones */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-stack-md border-y border-outline-variant mb-stack-lg">
            <div className="bg-surface-container-low rounded-lg p-4 text-center">
              <span aria-hidden="true" className="material-symbols-outlined text-primary mb-1">
                square_foot
              </span>
              <p className="font-headline-md text-headline-md text-on-surface">
                {property.construction_area_m2 ?? "—"}
              </p>
              <p className="font-label-sm text-label-sm text-secondary">
                m² Construcción
              </p>
            </div>
            <div className="bg-surface-container-low rounded-lg p-4 text-center">
              <span aria-hidden="true" className="material-symbols-outlined text-primary mb-1">
                bed
              </span>
              <p className="font-headline-md text-headline-md text-on-surface">
                {property.bedrooms ?? "—"}
              </p>
              <p className="font-label-sm text-label-sm text-secondary">
                Habitaciones
              </p>
            </div>
            <div className="bg-surface-container-low rounded-lg p-4 text-center">
              <span aria-hidden="true" className="material-symbols-outlined text-primary mb-1">
                shower
              </span>
              <p className="font-headline-md text-headline-md text-on-surface">
                {property.bathrooms ?? "—"}
              </p>
              <p className="font-label-sm text-label-sm text-secondary">Baños</p>
            </div>
            <div className="bg-surface-container-low rounded-lg p-4 text-center">
              <span aria-hidden="true" className="material-symbols-outlined text-primary mb-1">
                directions_car
              </span>
              <p className="font-headline-md text-headline-md text-on-surface">
                {property.parking_spaces ?? "—"}
              </p>
              <p className="font-label-sm text-label-sm text-secondary">
                Estacionamientos
              </p>
            </div>
          </div>

          {/* Descripción */}
          <h2 className="font-headline-md text-headline-md text-on-surface mb-4">
            Descripción
          </h2>
          {descriptionParagraphs.length > 0 ? (
            descriptionParagraphs.map((paragraph, i) => (
              <p
                key={i}
                className="font-body-md text-body-md text-secondary mb-4"
              >
                {paragraph}
              </p>
            ))
          ) : (
            <p className="font-body-md text-body-md text-secondary mb-4">
              No se ha agregado una descripción para esta propiedad. Contáctenos
              para más información.
            </p>
          )}

          {/* Amenidades */}
          {property.features.length > 0 && (
            <>
              <h2 className="font-headline-md text-headline-md text-on-surface mb-4 mt-stack-lg">
                Características y Amenidades
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-stack-lg">
                {property.features.map((feature) => (
                  <div
                    key={feature.label}
                    className="flex items-center gap-3 bg-surface-container-low rounded-lg p-4"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-primary">
                      {feature.icon}
                    </span>
                    <span className="font-body-md text-body-md text-on-surface">
                      {feature.label}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Mapa */}
          <h2 className="font-headline-md text-headline-md text-on-surface mb-4">
            Ubicación
          </h2>
          <div className="relative h-72 rounded-lg overflow-hidden border border-outline-variant mb-stack-lg">
            {mapEmbedUrl ? (
              <iframe
                src={mapEmbedUrl}
                title={`Mapa de ${property.title}`}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0 w-full h-full border-0"
              />
            ) : (
              <Image
                src={mapImageUrl}
                alt={`Mapa de ${property.title}`}
                fill
                sizes="100vw"
                className="object-cover"
              />
            )}
          </div>
        </div>

        {/* Tarjeta de agente */}
        <aside className="lg:col-span-1">
          <div className="bg-surface-container-low rounded-lg p-6 lg:sticky lg:top-24">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-primary-container flex items-center justify-center">
                <span aria-hidden="true" className="material-symbols-outlined text-on-primary-container">
                  person
                </span>
              </div>
              <div>
                <p className="font-headline-md text-headline-md text-on-surface">
                  {agentName}
                </p>
                <p className="font-label-sm text-label-sm text-secondary">
                  {agentRole}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 mb-6">
              {agentPhone ? (
                <a
                  href={`tel:${telHref}`}
                  className="flex items-center gap-2 font-body-md text-body-md text-secondary hover:text-primary transition-colors"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-base">
                    call
                  </span>
                  {agentPhone}
                </a>
              ) : null}
              {agentEmail ? (
                <a
                  href={`mailto:${agentEmail}`}
                  className="flex items-center gap-2 font-body-md text-body-md text-secondary hover:text-primary transition-colors"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-base">
                    mail
                  </span>
                  {agentEmail}
                </a>
              ) : null}
              {agentWhatsapp ? (
                <a
                  href={agentWhatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 font-body-md text-body-md text-secondary hover:text-primary transition-colors"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-base">
                    chat
                  </span>
                  WhatsApp
                </a>
              ) : null}
            </div>

            {agentWhatsapp ? (
              <a
                href={agentWhatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-primary text-on-primary text-center font-label-md text-label-md py-3 rounded hover:bg-primary-fixed-dim hover:text-on-primary-fixed transition-colors"
              >
                Solicitar una Visita
              </a>
            ) : (
              <Link
                href={`/contacto?propiedad=${encodeURIComponent(property.slug)}`}
                className="block w-full bg-primary text-on-primary text-center font-label-md text-label-md py-3 rounded hover:bg-primary-fixed-dim hover:text-on-primary-fixed transition-colors"
              >
                Solicitar una Visita
              </Link>
            )}
            <Link
              href={`/contacto?propiedad=${encodeURIComponent(property.slug)}`}
              className="block w-full mt-3 border border-primary text-primary text-center font-label-md text-label-md py-3 rounded hover:bg-primary-container transition-colors"
            >
              Solicitar Más Información
            </Link>
          </div>
        </aside>
      </div>

      {/* Propiedades relacionadas */}
      {related.length > 0 && (
        <div className="mt-stack-lg">
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-stack-md">
            Propiedades Similares
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            {related.map((p) => (
              <Link
                key={p.id}
                href={`/propiedades/${p.slug}`}
                className="group bg-surface-container-lowest rounded-lg border border-outline-variant overflow-hidden hover-lift image-scale-hover"
              >
                <div className="relative h-48 w-full overflow-hidden">
                  <Image
                    src={p.main_image_url ?? images.hero}
                    alt={p.title}
                    fill
                    quality={settings.imageQuality}
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-headline-md text-headline-md text-on-surface group-hover:text-primary transition-colors line-clamp-1">
                    {p.title}
                  </h3>
                  <p className="font-body-md text-body-md text-secondary line-clamp-1">
                    {p.locations?.name ?? "Consulte la ubicación"}
                  </p>
                  <p className="font-headline-md text-headline-md text-on-surface mt-2">
                    {formatPrice(p.price, p.currency, p.operation)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Inicio", item: `${site.url}/` },
              { "@type": "ListItem", position: 2, name: "Propiedades", item: `${site.url}/propiedades` },
              { "@type": "ListItem", position: 3, name: property.title, item: `${site.url}/propiedades/${property.slug}` },
            ],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": property.categories?.slug === "apartamento" ? "Apartment" : "SingleFamilyResidence",
            name: property.title,
            url: `${site.url}/propiedades/${property.slug}`,
            image: allImages.map((i) => i.url),
            description: descriptionParagraphs[0] ?? property.title,
            address: {
              "@type": "PostalAddress",
              streetAddress: property.address ?? undefined,
              addressLocality: property.locations?.name,
              addressCountry: settings.address.country,
            },
            numberOfRooms: property.bedrooms ?? undefined,
            numberOfBathroomsTotal: property.bathrooms ?? undefined,
            floorSize: property.construction_area_m2
              ? { "@type": "QuantitativeValue", value: property.construction_area_m2, unitCode: "MTK" }
              : undefined,
            offers: {
              "@type": "Offer",
              price: String(property.price),
              priceCurrency: property.currency,
              availability: "https://schema.org/InStock",
              url: `${site.url}/propiedades/${property.slug}`,
            },
            datePublished: property.published_at ?? undefined,
          }),
        }}
      />
    </>
  );
}
