import type { MetadataRoute } from "next";
import { getSiteSettings } from "@/lib/site-settings";

export const revalidate = 60;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSiteSettings();

  if (!settings.indexable) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  const base = settings.url.replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/acceso-panel/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
