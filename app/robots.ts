import type { MetadataRoute } from "next";
import { getSiteSettings } from "@/lib/site-settings";
import { adminPanelSlug } from "@/lib/demo-auth";

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
        disallow: ["/admin/", "/api/", `/${adminPanelSlug()}/`],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
