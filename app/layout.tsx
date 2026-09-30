import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import { getSiteSettings } from "@/lib/site-settings";
import { site } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

function metadataBaseUrl(raw: string): URL {
  try {
    return new URL(raw);
  } catch {
    return new URL(site.url);
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#506600",
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const description = `${settings.name} — ${settings.heroSubtitle}`;
  const base = settings.url.replace(/\/$/, "");
  return {
    metadataBase: metadataBaseUrl(settings.url),
    title: {
      default: settings.name,
      template: `%s | ${settings.name}`,
    },
    description,
    robots: settings.indexable
      ? { index: true, follow: true }
      : { index: false, follow: false, nocache: true },
    alternates: {
      canonical: base + "/",
    },
    openGraph: {
      type: "website",
      siteName: settings.name,
      title: settings.name,
      description: settings.heroSubtitle,
      url: base + "/",
      images: [
        {
          url: settings.heroImageUrl,
          width: 1200,
          height: 630,
          alt: settings.name,
        },
      ],
      locale: "es_HN",
    },
    twitter: {
      card: "summary_large_image",
      title: settings.name,
      description: settings.heroSubtitle,
      images: [settings.heroImageUrl],
    },
    icons: {
      icon: "/favicon.ico",
    },
    verification: settings.indexable ? undefined : undefined,
  };
}

export const revalidate = 60;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const settings = await getSiteSettings();
  const base = settings.url.replace(/\/$/, "");
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: settings.name,
    url: base + "/",
    logo: settings.logoUrl,
    image: settings.heroImageUrl,
    telephone: settings.phone,
    email: settings.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.address.line1,
      addressLocality: settings.address.line1,
      addressCountry: "HN",
    },
  };
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings.name,
    url: base + "/",
    potentialAction: {
      "@type": "SearchAction",
      target: `${base}/propiedades?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  return (
    <html
      lang="es"
      data-scroll-behavior="smooth"
      data-animations={settings.enableAnimations ? "on" : "off"}
      className={`${inter.variable} ${montserrat.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
        {!settings.enableAnimations ? (
          <style dangerouslySetInnerHTML={{ __html: `*{animation-duration:0.01ms !important;transition-duration:0.01ms !important}` }} />
        ) : null}
        <script
          type="speculationrules"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              prerender: [{ where: { href_matches: "/*" }, eagerness: "moderate" }],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
