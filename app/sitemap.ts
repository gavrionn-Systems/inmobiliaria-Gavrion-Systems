import type { MetadataRoute } from "next";
import { getPublishedProperties } from "@/lib/queries";
import { getSiteSettings } from "@/lib/site-settings";

export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getSiteSettings();
  if (!settings.indexable) {
    return [];
  }

  const base = settings.url.replace(/\/$/, "");
  const properties = await getPublishedProperties();

  const propertyUrls = properties.map((p) => ({
    url: `${base}/propiedades/${p.slug}`,
    lastModified: p.published_at ?? p.created_at,
    changeFrequency: "weekly" as const,
    priority: 0.8,
    images: p.main_image_url ? [p.main_image_url] : undefined,
  }));

  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    {
      url: `${base}/propiedades`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${base}/nosotros`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${base}/contacto`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${base}/privacidad`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/terminos`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    ...propertyUrls,
  ];
}
