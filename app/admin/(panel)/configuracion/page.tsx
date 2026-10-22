import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminRole, isDesignerRole, isTemplateAdminRole } from "@/lib/demo-auth";
import { getSiteSettings } from "@/lib/site-settings";
import { getChatboxSettings } from "@/lib/chatbox";
import type { SiteSettingsInput } from "@/lib/site-settings-actions";
import ChatboxSettingsForm from "./ChatboxSettingsForm";
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

  const [settings, chatbox] = await Promise.all([getSiteSettings(), getChatboxSettings()]);
  const isDesigner = isDesignerRole(session.user.role);
  const assignedCompanies = session.user.assignedCompanies ?? [];
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
        {isDesigner ? (
          <p className="mb-2 font-label-sm text-label-sm uppercase tracking-[0.16em] text-primary">
            Modo diseñador · Sitio actual
          </p>
        ) : null}
        <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-1">
          {isDesigner ? `Diseño de ${settings.name}` : "Configuración"}
        </h1>
        <p className="font-body-md text-body-md text-secondary">
          {isDesigner
            ? "Edita la identidad, el contenido y la experiencia visual de este sitio."
            : "Identidad pública y experiencia administrativa de la inmobiliaria: logo, contenido, panel interno y configuración — todo sin tocar código."}
        </p>
        {isDesigner ? (
          <div className="mt-5 flex flex-col gap-1 rounded-xl border border-primary/20 bg-primary-container/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-label-sm text-label-sm uppercase tracking-[0.12em] text-primary">
                Estás editando
              </p>
              <p className="truncate font-label-md text-label-md font-bold text-on-surface">
                {settings.name}
              </p>
              <p className="truncate text-sm text-secondary" title={settings.url}>
                {settings.url}
              </p>
            </div>
            <a
              href={settings.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-primary/30 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10 sm:self-center"
            >
              Ver sitio
              <span aria-hidden="true" className="material-symbols-outlined text-base">open_in_new</span>
            </a>
          </div>
        ) : null}
        {isDesigner && assignedCompanies.length > 1 ? (
          <div className="mt-4 rounded-xl border border-outline-variant bg-surface-container-low p-4">
            <p className="font-label-sm text-label-sm uppercase tracking-[0.12em] text-primary">
              Empresas asignadas a este diseñador
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {assignedCompanies.map((company) => (
                company.url ? (
                  <a
                    key={company.id}
                    href={company.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface hover:border-primary hover:text-primary"
                  >
                    <span className="truncate">{company.name}</span>
                    <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-base">open_in_new</span>
                  </a>
                ) : (
                  <span key={company.id} className="truncate rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface">
                    {company.name}
                  </span>
                )
              ))}
            </div>
            <p className="mt-3 text-sm text-secondary">
              Cada empresa tiene su propio proyecto Vercel y base Supabase. Abra el sitio correspondiente para editarlo; esta página siempre muestra el sitio en el que inició sesión.
            </p>
          </div>
        ) : null}
      </header>
      <SiteSettingsForm
        initial={initial}
        isCompanyAdmin={isAdminRole(session.user.role)}
        isDesigner={isDesigner}
      />
      <ChatboxSettingsForm
        initial={chatbox}
        installBaseUrl={(settings.url || process.env.APP_BASE_URL || "").replace(/\/$/, "")}
        canEdit={isAdminRole(session.user.role) || isTemplateAdminRole(session.user.role) || isDesignerRole(session.user.role)}
      />
    </>
  );
}
