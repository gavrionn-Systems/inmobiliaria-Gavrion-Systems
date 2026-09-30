import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { images } from "@/lib/properties";
import { site } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";

export type SiteStat = {
  value: string;
  label: string;
};

export type SiteValue = {
  icon: string;
  title: string;
  description: string;
};

export type SiteSettings = {
  name: string;
  url: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: {
    line1: string;
    line2: string;
  };
  logoUrl: string;
  heroImageUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  homeEyebrow: string;
  homeCatalogButton: string;
  homeContactButton: string;
  homeFeaturedTitle: string;
  homeFeaturedSubtitle: string;
  homeEmptyFeatured: string;
  homeCtaTitle: string;
  homeCtaText: string;
  homeCtaButton: string;
  catalogTitle: string;
  catalogSubtitle: string;
  catalogEmpty: string;
  aboutEyebrow: string;
  aboutTitle: string;
  aboutMissionTitle: string;
  aboutValuesTitle: string;
  contactEyebrow: string;
  contactTitle: string;
  contactSubtitle: string;
  social: {
    instagram: string;
    facebook: string;
  };
  hours: string;
  about: {
    mission: string;
    stats: SiteStat[];
    values: SiteValue[];
  };
  defaultAgentName: string;
  defaultAgentRole: string;
  /** Si es false, robots/sitemap/metadatos marcan noindex. */
  indexable: boolean;
  priceStep: number;
  priceFloor: number;
  priceCeilingOverride: number | null;
  // Rendimiento — editables desde Admin/Configuración
  catalogPerPage: number;
  featuredLimit: number;
  relatedLimit: number;
  revalidateHome: number;
  revalidateCatalog: number;
  revalidateProperty: number;
  imageQuality: number;
  heroPriority: boolean;
  enableAnimations: boolean;
  searchDebounceMs: number;
  priceSliderDebounceMs: number;
};

const FALLBACK_STATS: SiteStat[] = [
  { value: "—", label: "Propiedades gestionadas" },
  { value: "—", label: "Años de experiencia" },
  { value: "—", label: "Clientes atendidos" },
  { value: "—", label: "Agentes del equipo" },
];

const FALLBACK_VALUES: SiteValue[] = [
  {
    icon: "verified",
    title: "Precisión",
    description:
      "Datos verificados y procesos transparentes en cada transacción.",
  },
  {
    icon: "handshake",
    title: "Confianza",
    description:
      "Construimos relaciones duraderas con nuestros clientes, basadas en honestidad.",
  },
  {
    icon: "bolt",
    title: "Eficiencia",
    description:
      "Tecnología y metodología moderna para mover su propiedad más rápido.",
  },
];

export const FALLBACK_SITE_SETTINGS: SiteSettings = {
  name: site.name,
  url: site.url,
  email: site.email,
  phone: site.phone,
  whatsapp: site.whatsapp,
  address: {
    line1: site.address.line1,
    line2: site.address.line2,
  },
  logoUrl: site.logoUrl,
  heroImageUrl: images.hero,
  heroTitle: "Encuentre el espacio ideal para usted",
  heroSubtitle:
    "Encuentre el espacio adecuado con acompañamiento profesional durante todo el proceso.",
  homeEyebrow: "Estamos aquí para ayudarle a encontrar su próximo espacio",
  homeCatalogButton: "Ver todo el catálogo",
  homeContactButton: "Contactar un asesor",
  homeFeaturedTitle: "Propiedades destacadas",
  homeFeaturedSubtitle: "Una selección de propiedades disponibles para usted.",
  homeEmptyFeatured: "Aún no hay propiedades destacadas. Vuelva pronto.",
  homeCtaTitle: "¿Listo para encontrar su propiedad?",
  homeCtaText: "Contáctenos y permítanos acompañarle en su próxima decisión inmobiliaria.",
  homeCtaButton: "Contáctenos",
  catalogTitle: "Nuestras propiedades",
  catalogSubtitle: "Encuentre la propiedad adecuada utilizando nuestros filtros de búsqueda.",
  catalogEmpty: "No se encontraron propiedades con esos criterios.",
  aboutEyebrow: "Sobre nosotros",
  aboutTitle: "Construimos mejores experiencias inmobiliarias",
  aboutMissionTitle: "Nuestra misión",
  aboutValuesTitle: "Nuestros valores",
  contactEyebrow: "Estamos para ayudarle",
  contactTitle: "Contáctenos y agende una conversación",
  contactSubtitle: "Nuestro equipo le atenderá para conocer sus necesidades y orientarle.",
  social: {
    instagram: site.social.instagram,
    facebook: site.social.facebook,
  },
  hours:
    "Lunes a viernes, 8:00 a.m. – 5:00 p.m.\nSábados, 9:00 a.m. – 1:00 p.m.",
  about: {
    mission:
      "Ofrecemos acompañamiento profesional para ayudar a nuestros clientes a tomar mejores decisiones inmobiliarias.\n\nPersonalice este texto desde la sección Contenido del sitio.",
    stats: FALLBACK_STATS,
    values: FALLBACK_VALUES,
  },
  defaultAgentName: "Equipo inmobiliario",
  defaultAgentRole: "Asesor inmobiliario",
  indexable: false,
  priceStep: 5000,
  priceFloor: 0,
  priceCeilingOverride: null,
  catalogPerPage: 12,
  featuredLimit: 6,
  relatedLimit: 3,
  revalidateHome: 60,
  revalidateCatalog: 60,
  revalidateProperty: 60,
  imageQuality: 75,
  heroPriority: true,
  enableAnimations: true,
  searchDebounceMs: 350,
  priceSliderDebounceMs: 300,
};

type SiteSettingsRow = {
  name: string | null;
  site_url: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  address_line1: string | null;
  address_line2: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  home_eyebrow?: string | null;
  home_catalog_button?: string | null;
  home_contact_button?: string | null;
  home_featured_title?: string | null;
  home_featured_subtitle?: string | null;
  home_empty_featured?: string | null;
  home_cta_title?: string | null;
  home_cta_text?: string | null;
  home_cta_button?: string | null;
  catalog_title?: string | null;
  catalog_subtitle?: string | null;
  catalog_empty?: string | null;
  about_eyebrow?: string | null;
  about_title?: string | null;
  about_mission_title?: string | null;
  about_values_title?: string | null;
  contact_eyebrow?: string | null;
  contact_title?: string | null;
  contact_subtitle?: string | null;
  instagram: string | null;
  facebook: string | null;
  hours: string | null;
  about_mission: string | null;
  about_stats: unknown;
  about_values: unknown;
  default_agent_name: string | null;
  default_agent_role: string | null;
  indexable?: boolean | null;
  price_step?: number | null;
  price_floor?: number | null;
  price_ceiling_override?: number | null;
  catalog_per_page?: number | null;
  featured_limit?: number | null;
  related_limit?: number | null;
  revalidate_home?: number | null;
  revalidate_catalog?: number | null;
  revalidate_property?: number | null;
  image_quality?: number | null;
  hero_priority?: boolean | null;
  enable_animations?: boolean | null;
  search_debounce_ms?: number | null;
  price_slider_debounce_ms?: number | null;
};

function textOr(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function parseStats(value: unknown): SiteStat[] {
  if (!Array.isArray(value)) return FALLBACK_SITE_SETTINGS.about.stats;
  const parsed = value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.value !== "string" || typeof row.label !== "string") {
      return [];
    }
    return [{ value: row.value, label: row.label }];
  });
  return parsed.length > 0 ? parsed : FALLBACK_SITE_SETTINGS.about.stats;
}

function parseValues(value: unknown): SiteValue[] {
  if (!Array.isArray(value)) return FALLBACK_SITE_SETTINGS.about.values;
  const parsed = value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (
      typeof row.icon !== "string" ||
      typeof row.title !== "string" ||
      typeof row.description !== "string"
    ) {
      return [];
    }
    return [
      {
        icon: row.icon,
        title: row.title,
        description: row.description,
      },
    ];
  });
  return parsed.length > 0 ? parsed : FALLBACK_SITE_SETTINGS.about.values;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : fallback;
}

function fromRow(row: SiteSettingsRow): SiteSettings {
  const fallback = FALLBACK_SITE_SETTINGS;
  const priceStep =
    typeof row.price_step === "number" && row.price_step >= 1000 ? row.price_step : fallback.priceStep;
  const priceFloor =
    typeof row.price_floor === "number" && row.price_floor >= 0 ? row.price_floor : fallback.priceFloor;
  const priceCeilingOverride =
    typeof row.price_ceiling_override === "number" && row.price_ceiling_override >= 10000
      ? row.price_ceiling_override
      : null;
  return {
    name: textOr(row.name, fallback.name),
    url: textOr(row.site_url, fallback.url),
    email: textOr(row.email, fallback.email),
    phone: textOr(row.phone, fallback.phone),
    whatsapp: textOr(row.whatsapp, fallback.whatsapp),
    address: {
      line1: textOr(row.address_line1, fallback.address.line1),
      line2: textOr(row.address_line2, fallback.address.line2),
    },
    logoUrl: textOr(row.logo_url, fallback.logoUrl),
    heroImageUrl: textOr(row.hero_image_url, fallback.heroImageUrl),
    heroTitle: textOr(row.hero_title, fallback.heroTitle),
    heroSubtitle: textOr(row.hero_subtitle, fallback.heroSubtitle),
    homeEyebrow: textOr(row.home_eyebrow, fallback.homeEyebrow),
    homeCatalogButton: textOr(row.home_catalog_button, fallback.homeCatalogButton),
    homeContactButton: textOr(row.home_contact_button, fallback.homeContactButton),
    homeFeaturedTitle: textOr(row.home_featured_title, fallback.homeFeaturedTitle),
    homeFeaturedSubtitle: textOr(row.home_featured_subtitle, fallback.homeFeaturedSubtitle),
    homeEmptyFeatured: textOr(row.home_empty_featured, fallback.homeEmptyFeatured),
    homeCtaTitle: textOr(row.home_cta_title, fallback.homeCtaTitle),
    homeCtaText: textOr(row.home_cta_text, fallback.homeCtaText),
    homeCtaButton: textOr(row.home_cta_button, fallback.homeCtaButton),
    catalogTitle: textOr(row.catalog_title, fallback.catalogTitle),
    catalogSubtitle: textOr(row.catalog_subtitle, fallback.catalogSubtitle),
    catalogEmpty: textOr(row.catalog_empty, fallback.catalogEmpty),
    aboutEyebrow: textOr(row.about_eyebrow, fallback.aboutEyebrow),
    aboutTitle: textOr(row.about_title, fallback.aboutTitle),
    aboutMissionTitle: textOr(row.about_mission_title, fallback.aboutMissionTitle),
    aboutValuesTitle: textOr(row.about_values_title, fallback.aboutValuesTitle),
    contactEyebrow: textOr(row.contact_eyebrow, fallback.contactEyebrow),
    contactTitle: textOr(row.contact_title, fallback.contactTitle),
    contactSubtitle: textOr(row.contact_subtitle, fallback.contactSubtitle),
    social: {
      instagram: textOr(row.instagram, fallback.social.instagram),
      facebook: textOr(row.facebook, fallback.social.facebook),
    },
    hours: textOr(row.hours, fallback.hours),
    about: {
      mission: textOr(row.about_mission, fallback.about.mission),
      stats: parseStats(row.about_stats),
      values: parseValues(row.about_values),
    },
    defaultAgentName: textOr(row.default_agent_name, fallback.defaultAgentName),
    defaultAgentRole: textOr(row.default_agent_role, fallback.defaultAgentRole),
    indexable: row.indexable === true,
    priceStep,
    priceFloor,
    priceCeilingOverride,
    catalogPerPage: clampInt(row.catalog_per_page, 6, 48, fallback.catalogPerPage),
    featuredLimit: clampInt(row.featured_limit, 3, 12, fallback.featuredLimit),
    relatedLimit: clampInt(row.related_limit, 0, 6, fallback.relatedLimit),
    revalidateHome: clampInt(row.revalidate_home, 30, 600, fallback.revalidateHome),
    revalidateCatalog: clampInt(row.revalidate_catalog, 30, 600, fallback.revalidateCatalog),
    revalidateProperty: clampInt(row.revalidate_property, 30, 600, fallback.revalidateProperty),
    imageQuality: clampInt(row.image_quality, 60, 90, fallback.imageQuality),
    heroPriority: row.hero_priority !== false,
    enableAnimations: row.enable_animations !== false,
    searchDebounceMs: clampInt(row.search_debounce_ms, 100, 800, fallback.searchDebounceMs),
    priceSliderDebounceMs: clampInt(row.price_slider_debounce_ms, 100, 600, fallback.priceSliderDebounceMs),
  };
}

const BASE_SELECT =
  "name, site_url, email, phone, whatsapp, address_line1, address_line2, logo_url, hero_image_url, instagram, facebook, hours, about_mission, about_stats, about_values, default_agent_name, default_agent_role, home_eyebrow, home_catalog_button, home_contact_button, home_featured_title, home_featured_subtitle, home_empty_featured, home_cta_title, home_cta_text, home_cta_button, catalog_title, catalog_subtitle, catalog_empty, about_eyebrow, about_title, about_mission_title, about_values_title, contact_eyebrow, contact_title, contact_subtitle";
const HERO_SELECT = `${BASE_SELECT}, hero_title, hero_subtitle`;
const FULL_SELECT = `${HERO_SELECT}, indexable, price_step, price_floor, price_ceiling_override, catalog_per_page, featured_limit, related_limit, revalidate_home, revalidate_catalog, revalidate_property, image_quality, hero_priority, enable_animations, search_debounce_ms, price_slider_debounce_ms`;

type SettingsSelect = "full" | "hero" | "base";

/** Evita reintentar columnas que Postgres ya marcó como inexistentes (42703). */
let settingsSelect: SettingsSelect = "full";

async function loadSiteSettingsFromDb(): Promise<SiteSettings> {
  const supabase = createPublicClient();
  if (!supabase) return FALLBACK_SITE_SETTINGS;
  const client = supabase;

  async function read(select: string) {
    return client.from("site_settings").select(select).eq("id", 1).maybeSingle();
  }

  if (settingsSelect === "full") {
    const full = await read(FULL_SELECT);
    if (!full.error && full.data) {
      return fromRow(full.data as unknown as SiteSettingsRow);
    }
    if (full.error?.code === "42703") {
      settingsSelect = "hero";
    }
  }

  if (settingsSelect !== "base") {
    const hero = await read(HERO_SELECT);
    if (!hero.error && hero.data) {
      return fromRow(hero.data as unknown as SiteSettingsRow);
    }
    if (hero.error?.code === "42703") {
      settingsSelect = "base";
    }
  }

  const base = await read(BASE_SELECT);
  if (base.error || !base.data) {
    return FALLBACK_SITE_SETTINGS;
  }

  return fromRow(base.data as unknown as SiteSettingsRow);
}

const MEMORY_TTL_MS = 60_000;
let memoryCache: { at: number; value: SiteSettings } | null = null;

export function invalidateSiteSettingsMemory() {
  memoryCache = null;
}

/** Lee la fila de configuración. Si la tabla no existe o está vacía, usa site.ts. */
export const getSiteSettings = cache(async function getSiteSettings(): Promise<SiteSettings> {
  if (memoryCache && Date.now() - memoryCache.at < MEMORY_TTL_MS) {
    return memoryCache.value;
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return FALLBACK_SITE_SETTINGS;
  }

  try {
    const value = await unstable_cache(loadSiteSettingsFromDb, ["site-settings-v2"], {
      revalidate: 60,
      tags: ["site-settings"],
    })();
    memoryCache = { at: Date.now(), value };
    return value;
  } catch {
    return FALLBACK_SITE_SETTINGS;
  }
});
