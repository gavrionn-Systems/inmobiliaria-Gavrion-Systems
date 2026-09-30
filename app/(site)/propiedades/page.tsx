import type { Metadata } from "next";
import Link from "next/link";
import CatalogSearch from "@/components/search/CatalogSearch";
import PropertyCard from "@/components/PropertyCard";
import {
  getCatalogPage,
  getCatalogPriceBounds,
  getCategoriesPublic,
  getLocationsPublic,
  toPropertySummary,
} from "@/lib/queries";
import {
  buildCatalogQuery,
  hasActiveFilters,
  parseCatalogSearchParams,
  catalogFiltersToParams,
  catalogPageHref,
} from "@/lib/catalog-params";
import { getSiteSettings } from "@/lib/site-settings";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const filters = parseCatalogSearchParams(sp);
  const settings = await getSiteSettings();
  const hasFilters = hasActiveFilters(filters) || filters.pagina > 1;
  const base = settings.url.replace(/\/$/, "");
  const canonicalPath = hasFilters ? buildCatalogQuery(filters, { pagina: filters.pagina }) : "/propiedades";
  const canonical = `${base}${canonicalPath}`;
  const title = hasFilters
    ? `Propiedades filtradas | ${settings.name}`
    : `Propiedades | ${settings.name}`;
  const description =
      settings.catalogSubtitle;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      images: [{ url: settings.heroImageUrl, width: 1200, height: 630, alt: settings.name }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [settings.heroImageUrl],
    },
    robots: hasFilters ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function PropiedadesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const parsed = parseCatalogSearchParams(sp);
  const { q, op, tipo, ubi, muni, pmin, pmax, hab, orden, pagina } = parsed;
  const filters = { q, op, tipo, ubi, muni, pmin, pmax, hab, orden };

  const settings = await getSiteSettings();
  const [categories, locations, priceBounds, catalog] = await Promise.all([
    getCategoriesPublic(),
    getLocationsPublic(),
    getCatalogPriceBounds(),
    getCatalogPage({
      ...catalogFiltersToParams(filters),
      page: pagina,
      perPage: settings.catalogPerPage,
    }),
  ]);

  const properties = catalog.rows.map(toPropertySummary);
  const totalPages = Math.max(1, Math.ceil(catalog.total / catalog.perPage));

  function pageHref(p: number) {
    return catalogPageHref(filters, p);
  }

  const pageLinkCls =
    "px-4 py-2.5 rounded border border-outline-variant font-label-md text-label-md text-secondary hover:text-primary hover:border-primary transition-colors inline-flex items-center";

  return (
    <section className="pt-28 pb-stack-lg max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
      <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2">
        {settings.catalogTitle}
      </h1>
      <p className="font-body-lg text-body-lg text-secondary mb-stack-lg">
        {settings.catalogSubtitle}
      </p>

      <CatalogSearch
        categories={categories}
        locations={locations}
        total={catalog.total}
        priceBounds={priceBounds}
        filters={filters}
        variant="catalog"
        searchDebounceMs={settings.searchDebounceMs}
        priceSliderDebounceMs={settings.priceSliderDebounceMs}
      />

      {properties.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-gutter">
          {properties.map((property, index) => (
            <PropertyCard
              key={property.id}
              property={property}
              variant="catalog"
              priority={index === 0}
              quality={settings.imageQuality}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-stack-lg bg-surface-container-low rounded-lg">
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-4xl text-secondary mb-2"
          >
            search_off
          </span>
          <p className="font-body-lg text-body-lg text-secondary">
            {settings.catalogEmpty}
          </p>
        </div>
      )}

      {totalPages > 1 && (
        <nav
          className="flex items-center justify-center gap-3 mt-stack-lg"
          aria-label="Paginación del catálogo"
        >
          {catalog.page > 1 ? (
            <Link href={pageHref(catalog.page - 1)} className={pageLinkCls}>
              Anterior
            </Link>
          ) : (
            <span
              className={`${pageLinkCls} opacity-50 pointer-events-none`}
              aria-disabled="true"
            >
              Anterior
            </span>
          )}
          <span className="font-label-md text-label-md text-secondary">
            Página {catalog.page} de {totalPages}
          </span>
          {catalog.page < totalPages ? (
            <Link href={pageHref(catalog.page + 1)} className={pageLinkCls}>
              Siguiente
            </Link>
          ) : (
            <span
              className={`${pageLinkCls} opacity-50 pointer-events-none`}
              aria-disabled="true"
            >
              Siguiente
            </span>
          )}
        </nav>
      )}
    </section>
  );
}
