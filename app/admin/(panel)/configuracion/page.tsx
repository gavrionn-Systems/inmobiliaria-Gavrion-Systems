import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminRole, isDesignerRole, isTemplateAdminRole } from "@/lib/demo-auth";
import { getSiteSettings } from "@/lib/site-settings";
import type { SiteSettingsInput } from "@/lib/site-settings-actions";
import SiteSettingsForm from "./SiteSettingsForm";

export const metadata = {
  title: "Configuración · Admin",
};

export const dynamic = "force-dynamic";

const EMPTY_STAT = { value: "", label: "" };
const EMPTY_VALUE = { icon: "verified", title: "", description: "" };

function padStats(
  stats: SiteSettingsInput["aboutStats"]
): SiteSettingsInput["aboutStats"] {
  const next = stats.slice(0, 4);
  while (next.length < 4) next.push({ ...EMPTY_STAT });
  return next;
}

function padValues(
  values: SiteSettingsInput["aboutValues"]
): SiteSettingsInput["aboutValues"] {
  const next = values.slice(0, 3);
  while (next.length < 3) next.push({ ...EMPTY_VALUE });
  return next;
}

export default async function AdminConfiguracionPage() {
  const session = await getSession();
  if (!session || (!isAdminRole(session.user.role) && !isTemplateAdminRole(session.user.role) && !isDesignerRole(session.user.role))) {
    redirect("/admin?error=forbidden");
  }

  const settings = await getSiteSettings();
  const initial: SiteSettingsInput = {
    name: settings.name,
    url: settings.url,
    logoUrl: settings.logoUrl,
    email: settings.email,
    phone: settings.phone,
    addressLine1: settings.address.line1,
    addressLine2: settings.address.line2,
    city: settings.address.city,
    country: settings.address.country,
    mapUrl: settings.mapUrl,
    primaryColor: settings.primaryColor,
    accentColor: settings.accentColor,
    adminColor: settings.adminColor,
    backgroundColor: settings.backgroundColor,
    whatsapp: settings.whatsapp,
    instagram: settings.social.instagram,
    facebook: settings.social.facebook,
    hours: settings.hours,
    adminLoginTitle: settings.adminLoginTitle,
    adminLoginSubtitle: settings.adminLoginSubtitle,
    adminPanelLabel: settings.adminPanelLabel,
    adminWelcomeTitle: settings.adminWelcomeTitle,
    adminWelcomeSubtitle: settings.adminWelcomeSubtitle,
    adminMenuLabel: settings.adminMenuLabel,
    adminMenuVisibility: settings.adminMenuVisibility,
    heroTitle: settings.heroTitle,
    heroSubtitle: settings.heroSubtitle,
    heroImageUrl: settings.heroImageUrl,
    homeEyebrow: settings.homeEyebrow,
    homeCatalogButton: settings.homeCatalogButton,
    homeContactButton: settings.homeContactButton,
    homeFeaturedTitle: settings.homeFeaturedTitle,
    homeFeaturedSubtitle: settings.homeFeaturedSubtitle,
    homeEmptyFeatured: settings.homeEmptyFeatured,
    homeCtaTitle: settings.homeCtaTitle,
    homeCtaText: settings.homeCtaText,
    homeCtaButton: settings.homeCtaButton,
    catalogTitle: settings.catalogTitle,
    catalogSubtitle: settings.catalogSubtitle,
    catalogEmpty: settings.catalogEmpty,
    aboutEyebrow: settings.aboutEyebrow,
    aboutTitle: settings.aboutTitle,
    aboutMissionTitle: settings.aboutMissionTitle,
    aboutValuesTitle: settings.aboutValuesTitle,
    contactEyebrow: settings.contactEyebrow,
    contactTitle: settings.contactTitle,
    contactSubtitle: settings.contactSubtitle,
    aboutMission: settings.about.mission,
    aboutStats: padStats(settings.about.stats),
    aboutValues: padValues(settings.about.values),
    defaultAgentName: settings.defaultAgentName,
    defaultAgentRole: settings.defaultAgentRole,
    indexable: settings.indexable,
    priceStep: settings.priceStep,
    priceFloor: settings.priceFloor,
    priceCeilingOverride: settings.priceCeilingOverride,
    catalogPerPage: settings.catalogPerPage,
    featuredLimit: settings.featuredLimit,
    relatedLimit: settings.relatedLimit,
    revalidateHome: settings.revalidateHome,
    revalidateCatalog: settings.revalidateCatalog,
    revalidateProperty: settings.revalidateProperty,
    imageQuality: settings.imageQuality,
    heroPriority: settings.heroPriority,
    enableAnimations: settings.enableAnimations,
    searchDebounceMs: settings.searchDebounceMs,
    priceSliderDebounceMs: settings.priceSliderDebounceMs,
  };

  return (
    <>
      <header className="mb-8">
        <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-1">
          Configuración
        </h1>
        <p className="font-body-md text-body-md text-secondary">
          Identidad pública y experiencia administrativa de la inmobiliaria:
          logo, contenido, panel interno y configuración — todo sin tocar código.
        </p>
      </header>
      <SiteSettingsForm initial={initial} />
    </>
  );
}
