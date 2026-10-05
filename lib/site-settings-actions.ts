"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { isPlatformRole } from "@/lib/rbac";
import { invalidateSiteSettingsMemory } from "@/lib/site-settings";
import { createAdminClient } from "@/lib/supabase/admin";

export type SiteSettingsActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type SiteSettingsInput = {
  name: string;
  url: string;
  logoUrl: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  country: string;
  mapUrl: string;
  primaryColor: string;
  accentColor: string;
  adminColor: string;
  backgroundColor: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  hours: string;
  adminLoginTitle: string;
  adminLoginSubtitle: string;
  adminPanelLabel: string;
  adminWelcomeTitle: string;
  adminWelcomeSubtitle: string;
  adminMenuLabel: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
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
  aboutMission: string;
  aboutStats: { value: string; label: string }[];
  aboutValues: { icon: string; title: string; description: string }[];
  defaultAgentName: string;
  defaultAgentRole: string;
  indexable: boolean;
  priceStep: number;
  priceFloor: number;
  priceCeilingOverride: number | null;
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

const isHttp = (v: string) => /^https?:\/\//i.test(v);
const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use un color hexadecimal válido, por ejemplo #506600.");

const siteStatSchema = z.object({
  value: z.string().trim().min(1, "Escriba la cifra.").max(24),
  label: z.string().trim().min(1, "Escriba la etiqueta de la cifra.").max(80),
});

const siteValueSchema = z.object({
  icon: z.string().trim().min(1, "Indique el icono.").max(40),
  title: z.string().trim().min(1, "Escriba el título del valor.").max(60),
  description: z
    .string()
    .trim()
    .min(3, "Escriba la descripción del valor.")
    .max(280),
});

const siteSettingsInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Escriba el nombre de la inmobiliaria.")
    .max(120),
  url: z
    .string()
    .trim()
    .max(300)
    .refine((v) => isHttp(v), "La URL del sitio debe comenzar con http(s)."),
  logoUrl: z
    .string()
    .trim()
    .min(8, "Indique la URL del logo.")
    .max(2000)
    .refine((v) => isHttp(v), "El logo debe ser una URL http(s)."),
  email: z.email("Escriba un email válido.").max(160),
  phone: z.string().trim().min(5, "Escriba un teléfono.").max(40),
  addressLine1: z.string().trim().max(200),
  addressLine2: z.string().trim().max(80),
  city: z.string().trim().max(120),
  country: z.string().trim().max(120),
  mapUrl: z
    .string()
    .trim()
    .max(1000)
    .refine((v) => !v || isHttp(v), "El mapa debe ser una URL http(s)."),
  primaryColor: hexColor,
  accentColor: hexColor,
  adminColor: hexColor,
  backgroundColor: hexColor,
  whatsapp: z.string().trim().max(200),
  instagram: z.string().trim().max(300),
  facebook: z.string().trim().max(300),
  hours: z.string().trim().max(500),
  adminLoginTitle: z.string().trim().min(1).max(120),
  adminLoginSubtitle: z.string().trim().max(240),
  adminPanelLabel: z.string().trim().min(1).max(120),
  adminWelcomeTitle: z.string().trim().min(1).max(160),
  adminWelcomeSubtitle: z.string().trim().max(300),
  adminMenuLabel: z.string().trim().min(1).max(60),
  heroTitle: z
    .string()
    .trim()
    .min(3, "Escriba el título de la portada.")
    .max(200),
  heroSubtitle: z.string().trim().max(400),
  heroImageUrl: z
    .string()
    .trim()
    .min(8, "Indique la URL de la foto de portada.")
    .max(2000)
    .refine((v) => isHttp(v), "La foto de portada debe ser una URL http(s)."),
  homeEyebrow: z.string().trim().min(1).max(160),
  homeCatalogButton: z.string().trim().min(1).max(80),
  homeContactButton: z.string().trim().min(1).max(80),
  homeFeaturedTitle: z.string().trim().min(1).max(120),
  homeFeaturedSubtitle: z.string().trim().max(300),
  homeEmptyFeatured: z.string().trim().max(240),
  homeCtaTitle: z.string().trim().min(1).max(160),
  homeCtaText: z.string().trim().max(400),
  homeCtaButton: z.string().trim().min(1).max(80),
  catalogTitle: z.string().trim().min(1).max(120),
  catalogSubtitle: z.string().trim().max(300),
  catalogEmpty: z.string().trim().max(240),
  aboutEyebrow: z.string().trim().min(1).max(80),
  aboutTitle: z.string().trim().min(1).max(160),
  aboutMissionTitle: z.string().trim().min(1).max(120),
  aboutValuesTitle: z.string().trim().min(1).max(120),
  contactEyebrow: z.string().trim().min(1).max(160),
  contactTitle: z.string().trim().min(1).max(160),
  contactSubtitle: z.string().trim().max(400),
  aboutMission: z
    .string()
    .trim()
    .min(20, "Escriba la misión (al menos un párrafo).")
    .max(4000),
  aboutStats: z
    .array(siteStatSchema)
    .min(1, "Indique al menos una cifra.")
    .max(4),
  aboutValues: z
    .array(siteValueSchema)
    .length(3, "Indique exactamente 3 valores."),
  defaultAgentName: z.string().trim().max(120),
  defaultAgentRole: z.string().trim().max(120),
  indexable: z.boolean(),
  priceStep: z.coerce.number().int().min(1000).max(50000),
  priceFloor: z.coerce.number().int().min(0).max(1000000),
  priceCeilingOverride: z
    .union([z.coerce.number().int().min(10000).max(10000000), z.literal(""), z.null()])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  catalogPerPage: z.coerce.number().int().min(6).max(48),
  featuredLimit: z.coerce.number().int().min(3).max(12),
  relatedLimit: z.coerce.number().int().min(0).max(6),
  revalidateHome: z.coerce.number().int().min(30).max(600),
  revalidateCatalog: z.coerce.number().int().min(30).max(600),
  revalidateProperty: z.coerce.number().int().min(30).max(600),
  imageQuality: z.coerce.number().int().min(60).max(90),
  heroPriority: z.boolean(),
  enableAnimations: z.boolean(),
  searchDebounceMs: z.coerce.number().int().min(100).max(800),
  priceSliderDebounceMs: z.coerce.number().int().min(100).max(600),
});

function normalizeWhatsApp(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (isHttp(trimmed) || trimmed.startsWith("wa.me/")) {
    return trimmed.startsWith("wa.me/") ? `https://${trimmed}` : trimmed;
  }
  const digits = trimmed.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : trimmed;
}

function normalizeSiteUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (isHttp(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

async function requireAdmin(): Promise<SiteSettingsActionResult | null> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "No autorizado. Inicie sesión nuevamente." };
  }
  if (!isPlatformRole(session.user.role)) {
    return { ok: false, error: "No tiene permisos para esta acción." };
  }
  return null;
}

function revalidateSite() {
  invalidateSiteSettingsMemory();
  revalidateTag("site-settings", "max");
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/contacto");
  revalidatePath("/nosotros");
  revalidatePath("/propiedades");
  revalidatePath("/admin");
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/login");
  revalidatePath("/sitemap.xml");
  revalidatePath("/robots.txt");
}

type ParsedSettings = z.infer<typeof siteSettingsInputSchema>;

function contactPayload(data: ParsedSettings) {
  return {
    name: data.name,
    site_url: data.url,
    email: data.email,
    phone: data.phone,
    whatsapp: data.whatsapp,
    address_line1: data.addressLine1,
    address_line2: data.addressLine2,
    logo_url: data.logoUrl,
    instagram: data.instagram || "#",
    facebook: data.facebook || "#",
    hours: data.hours,
    default_agent_name: data.defaultAgentName,
    default_agent_role: data.defaultAgentRole,
    price_step: data.priceStep,
    price_floor: data.priceFloor,
    price_ceiling_override: data.priceCeilingOverride,
  };
}

function locationThemePayload(data: ParsedSettings) {
  return {
    address_city: data.city,
    address_country: data.country,
    map_url: data.mapUrl,
    primary_color: data.primaryColor.toLowerCase(),
    accent_color: data.accentColor.toLowerCase(),
    admin_color: data.adminColor.toLowerCase(),
    background_color: data.backgroundColor.toLowerCase(),
  };
}

function adminPayload(data: ParsedSettings) {
  return {
    admin_login_title: data.adminLoginTitle,
    admin_login_subtitle: data.adminLoginSubtitle,
    admin_panel_label: data.adminPanelLabel,
    admin_welcome_title: data.adminWelcomeTitle,
    admin_welcome_subtitle: data.adminWelcomeSubtitle,
    admin_menu_label: data.adminMenuLabel,
  };
}

function performancePayload(data: ParsedSettings) {
  return {
    catalog_per_page: data.catalogPerPage,
    featured_limit: data.featuredLimit,
    related_limit: data.relatedLimit,
    revalidate_home: data.revalidateHome,
    revalidate_catalog: data.revalidateCatalog,
    revalidate_property: data.revalidateProperty,
    image_quality: data.imageQuality,
    hero_priority: data.heroPriority,
    enable_animations: data.enableAnimations,
    search_debounce_ms: data.searchDebounceMs,
    price_slider_debounce_ms: data.priceSliderDebounceMs,
  };
}

function aboutPayload(data: ParsedSettings) {
  return {
    hero_image_url: data.heroImageUrl,
    about_mission: data.aboutMission,
    about_stats: data.aboutStats,
    about_values: data.aboutValues,
  };
}

function heroCopyPayload(data: ParsedSettings) {
  return {
    hero_title: data.heroTitle,
    hero_subtitle: data.heroSubtitle,
  };
}

function contentPayload(data: ParsedSettings) {
  return {
    home_eyebrow: data.homeEyebrow,
    home_catalog_button: data.homeCatalogButton,
    home_contact_button: data.homeContactButton,
    home_featured_title: data.homeFeaturedTitle,
    home_featured_subtitle: data.homeFeaturedSubtitle,
    home_empty_featured: data.homeEmptyFeatured,
    home_cta_title: data.homeCtaTitle,
    home_cta_text: data.homeCtaText,
    home_cta_button: data.homeCtaButton,
    catalog_title: data.catalogTitle,
    catalog_subtitle: data.catalogSubtitle,
    catalog_empty: data.catalogEmpty,
    about_eyebrow: data.aboutEyebrow,
    about_title: data.aboutTitle,
    about_mission_title: data.aboutMissionTitle,
    about_values_title: data.aboutValuesTitle,
    contact_eyebrow: data.contactEyebrow,
    contact_title: data.contactTitle,
    contact_subtitle: data.contactSubtitle,
  };
}

function insertPayload(data: ParsedSettings) {
  return {
    id: 1,
    ...contactPayload(data),
    ...locationThemePayload(data),
    ...adminPayload(data),
    ...aboutPayload(data),
    ...heroCopyPayload(data),
    ...contentPayload(data),
    ...performancePayload(data),
    indexable: data.indexable,
  };
}

export async function saveSiteSettings(
  input: SiteSettingsInput
): Promise<SiteSettingsActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const normalized: SiteSettingsInput = {
    ...input,
    url: normalizeSiteUrl(input.url),
    whatsapp: normalizeWhatsApp(input.whatsapp),
    aboutStats: input.aboutStats.filter(
      (row) => row.value.trim() || row.label.trim()
    ),
    aboutValues: input.aboutValues.map((row) => ({
      icon: row.icon.trim() || "verified",
      title: row.title,
      description: row.description,
    })),
  };

  const parsed = siteSettingsInputSchema.safeParse(normalized);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }

  const data = parsed.data;
  const supabase = createAdminClient();

  const updateFull = {
    ...contactPayload(data),
    ...locationThemePayload(data),
    ...adminPayload(data),
    ...aboutPayload(data),
    ...heroCopyPayload(data),
    ...contentPayload(data),
    ...performancePayload(data),
    indexable: data.indexable,
  };
  const updateWithPerformance = {
    ...contactPayload(data),
    ...locationThemePayload(data),
    ...adminPayload(data),
    ...aboutPayload(data),
    ...heroCopyPayload(data),
    ...contentPayload(data),
    ...performancePayload(data),
  };
  const updateWithAbout = {
    ...contactPayload(data),
    ...locationThemePayload(data),
    ...adminPayload(data),
    ...aboutPayload(data),
    ...heroCopyPayload(data),
    ...contentPayload(data),
  };
  const updateWithHero = {
    ...contactPayload(data),
    ...locationThemePayload(data),
    ...adminPayload(data),
    ...heroCopyPayload(data),
  };
  const updateBase = contactPayload(data);

  const { data: existing, error: readError } = await supabase
    .from("site_settings")
    .select("id")
    .eq("id", 1)
    .maybeSingle();

  if (readError) {
    console.error("[site-settings] Error al leer configuración:", readError);
    return { ok: false, error: "No se pudo guardar la configuración. Intente de nuevo." };
  }

  if (!existing) {
    const fullInsert = insertPayload(data);
    const inserted = await supabase.from("site_settings").insert(fullInsert);
    if (inserted.error) {
      const { indexable, ...withoutIndexable } = fullInsert;
      void indexable;
      const retryIndexable = await supabase
        .from("site_settings")
        .insert(withoutIndexable);
      if (retryIndexable.error) {
        const { hero_title, hero_subtitle, ...withoutHero } = withoutIndexable;
        void hero_title;
        void hero_subtitle;
        const retry = await supabase.from("site_settings").insert(withoutHero);
        if (retry.error) {
          console.error("[site-settings] Error al crear configuración:", retry.error);
          return {
            ok: false,
            error: "No se pudo guardar la configuración. Intente de nuevo.",
          };
        }
      }
    }
    revalidateSite();
    await auditLog({ action: "site_settings.created", entityType: "site_settings", entityId: "1" });
    return { ok: true };
  }

  const attempts = [updateFull, updateWithPerformance, updateWithAbout, updateWithHero, updateBase];
  let lastError: { message?: string } | null = null;
  for (const payload of attempts) {
    const updated = await supabase
      .from("site_settings")
      .update(payload)
      .eq("id", 1);
    if (!updated.error) {
      revalidateSite();
      await auditLog({ action: "site_settings.updated", entityType: "site_settings", entityId: "1" });
      return { ok: true };
    }
    lastError = updated.error;
  }

  console.error("[site-settings] Error al actualizar configuración:", lastError);
  return {
    ok: false,
    error: "No se pudo guardar la configuración. Intente de nuevo.",
  };
}
