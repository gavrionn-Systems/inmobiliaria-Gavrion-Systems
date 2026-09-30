import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import CatalogSearch from "@/components/search/CatalogSearch";
import PropertyCard from "@/components/PropertyCard";
import RevealOnScroll from "@/components/RevealOnScroll";
import { images } from "@/lib/properties";
import {
  getCatalogPriceBounds,
  getCategoriesPublic,
  getFeaturedProperties,
  getLocationsPublic,
  toPropertySummary,
} from "@/lib/queries";
import { getSiteSettings } from "@/lib/site-settings";
import { DEFAULT_CATALOG_FILTERS } from "@/lib/catalog-params";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const title = `${settings.heroTitle} | ${settings.name}`;
  const description = settings.heroSubtitle;
  const canonical = "/";
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      images: [{ url: settings.heroImageUrl, width: 1200, height: 630, alt: settings.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [settings.heroImageUrl],
    },
  };
}

export default async function HomePage() {
  const settings = await getSiteSettings();
  const [featuredRaw, categories, locations, priceBounds] = await Promise.all([
    getFeaturedProperties(settings.featuredLimit).then((rows) => rows.map(toPropertySummary)),
    getCategoriesPublic(),
    getLocationsPublic(),
    getCatalogPriceBounds(),
  ]);
  const featured = featuredRaw;

  const heroTitle = settings.heroTitle.trim();
  const heroSubtitle = settings.heroSubtitle.trim();
  const heroImage = settings.heroImageUrl || images.hero;

  return (
    <>
      {/* Hero — animación minimalista: ken burns + reveal escalonado */}
      <section className="relative bg-secondary h-auto flex items-center overflow-hidden site-header-offset py-10 sm:py-14 md:py-20">
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src={heroImage}
            alt="Casa moderna minimalista en el bosque durante el atardecer"
            fill
            priority={settings.heroPriority}
            quality={settings.imageQuality}
            sizes="100vw"
            className="object-cover opacity-60 hero-kenburns"
          />
          <div className="absolute inset-0 bg-secondary/75 md:bg-gradient-to-r md:from-secondary md:via-secondary/75 md:to-secondary/35" />
          <div aria-hidden="true" className="hero-glow absolute inset-0 pointer-events-none" />
        </div>

        <div className="relative z-10 max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop w-full">
          <p className="hero-reveal hero-reveal--1 font-label-md text-label-md text-primary-fixed uppercase tracking-widest mb-3 md:mb-4">
            {settings.homeEyebrow}
          </p>
          <h1 className="hero-reveal hero-reveal--2 font-headline-xl text-headline-xl text-surface max-w-2xl mb-4 md:mb-6">
            {heroTitle}
          </h1>
          <p className="hero-reveal hero-reveal--3 font-body-lg text-body-lg text-surface max-w-xl mb-2 text-pretty">
            {heroSubtitle}
          </p>

          <div className="hero-reveal hero-reveal--4">
            <CatalogSearch
              categories={categories}
              locations={locations}
              priceBounds={priceBounds}
              filters={DEFAULT_CATALOG_FILTERS}
              variant="hero"
              searchDebounceMs={settings.searchDebounceMs}
              priceSliderDebounceMs={settings.priceSliderDebounceMs}
            />
          </div>

          <div className="hero-reveal hero-reveal--5 flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6">
            <Link
              href="/propiedades"
              className="inline-flex items-center justify-center min-h-11 w-full sm:w-auto border border-surface text-surface font-label-md text-label-md px-8 py-3 rounded hover:bg-surface hover:text-secondary transition-colors text-center"
            >
              {settings.homeCatalogButton}
            </Link>
            <Link
              href="/contacto"
              className="inline-flex items-center justify-center min-h-11 w-full sm:w-auto border border-surface/70 text-surface font-label-md text-label-md px-8 py-3 rounded hover:bg-surface hover:text-secondary transition-colors text-center"
            >
              {settings.homeContactButton}
            </Link>
          </div>
        </div>
      </section>

      {/* Propiedades destacadas — reveal al scroll */}
      <section className="py-12 md:py-16 lg:py-20">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
          <RevealOnScroll>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2">
              {settings.homeFeaturedTitle}
            </h2>
            <p className="font-body-md text-body-md text-secondary mb-stack-lg">
              {settings.homeFeaturedSubtitle}
            </p>
          </RevealOnScroll>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
            {featured.map((property, index) => (
              <RevealOnScroll key={property.id} delay={index * 70}>
                <PropertyCard
                  property={property}
                  priority={index === 0 && settings.heroPriority}
                  quality={settings.imageQuality}
                />
              </RevealOnScroll>
            ))}
            {featured.length === 0 && (
              <p className="font-body-md text-body-md text-secondary md:col-span-2 lg:col-span-3">
                {settings.homeEmptyFeatured}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* CTA final — reveal sutil */}
      <section className="py-12 md:py-16 lg:py-20">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
          <RevealOnScroll>
            <div className="bg-secondary rounded-lg p-6 sm:p-8 md:p-12 text-center flex flex-col items-center">
              <h2 className="font-headline-lg text-headline-lg text-surface mb-4">
                {settings.homeCtaTitle}
              </h2>
              <p className="font-body-lg text-body-lg text-surface-variant max-w-xl mb-8">
                {settings.homeCtaText}
              </p>
              <Link
                href="/contacto"
                className="inline-flex items-center justify-center min-h-11 w-full sm:w-auto bg-primary-container text-on-primary-container font-label-md text-label-md px-8 py-3 rounded hover:bg-primary-fixed-dim hover:text-on-primary-fixed transition-colors"
              >
                {settings.homeCtaButton}
              </Link>
            </div>
          </RevealOnScroll>
        </div>
      </section>
    </>
  );
}
