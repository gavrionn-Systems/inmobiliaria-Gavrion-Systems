import type { Metadata } from "next";
import Image from "next/image";
import { getSiteSettings } from "@/lib/site-settings";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const base = settings.url.replace(/\/$/, "");
  const title = `Nosotros | ${settings.name}`;
  const description = `Conozca a ${settings.name}: precisión, confianza y eficiencia moderna en cada transacción.`;
  return {
    title,
    description,
    alternates: { canonical: `${base}/nosotros` },
    openGraph: {
      title,
      description,
      url: `${base}/nosotros`,
      images: [{ url: settings.heroImageUrl, width: 1200, height: 630, alt: settings.name }],
    },
    twitter: { card: "summary_large_image", title, description, images: [settings.heroImageUrl] },
  };
}

function missionParagraphs(mission: string) {
  const parts = mission
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [mission.trim()].filter(Boolean);
}

export default async function NosotrosPage() {
  const settings = await getSiteSettings();
  const paragraphs = missionParagraphs(settings.about.mission);
  const stats =
    settings.about.stats.length > 0
      ? settings.about.stats
      : [
          { value: "—", label: "Propiedades gestionadas" },
          { value: "Local", label: "Mercado" },
          { value: "1:1", label: "Acompañamiento" },
          { value: "CRM", label: "Seguimiento" },
        ];
  const values =
    settings.about.values.length > 0
      ? settings.about.values
      : [
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
              "Relaciones duraderas con nuestros clientes, basadas en honestidad.",
          },
          {
            icon: "bolt",
            title: "Eficiencia",
            description:
              "Tecnología y metodología moderna para mover su propiedad más rápido.",
          },
        ];

  return (
    <section className="pt-24 pb-stack-lg max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
      <div className="relative h-72 md:h-96 rounded-lg overflow-hidden mb-stack-lg">
        <Image
          src={settings.heroImageUrl}
          alt={`Equipo de ${settings.name} frente a una propiedad moderna`}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-secondary/80 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6 md:p-10">
          <p className="font-label-md text-label-md text-primary-fixed uppercase tracking-widest mb-2">
            {settings.aboutEyebrow}
          </p>
          <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-surface">
            {settings.aboutTitle}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter items-start mb-stack-lg">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-4">
            {settings.aboutMissionTitle}
          </h2>
          {paragraphs.map((paragraph) => (
            <p
              key={paragraph.slice(0, 48)}
              className="font-body-md text-body-md text-secondary mb-4 last:mb-0"
            >
              {paragraph}
            </p>
          ))}
        </div>
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-4">
            {settings.aboutValuesTitle}
          </h2>
          <div className="flex flex-col gap-4">
            {values.map((value) => (
              <div
                key={value.title}
                className="flex items-start gap-4 bg-surface-container-low rounded-lg p-5"
              >
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined text-primary"
                >
                  {value.icon}
                </span>
                <div>
                  <p className="font-headline-md text-headline-md text-on-surface mb-1">
                    {value.title}
                  </p>
                  <p className="font-body-md text-body-md text-secondary">
                    {value.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-gutter py-stack-lg">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-secondary rounded-lg p-6 text-center"
          >
            <p className="font-headline-md text-headline-md text-primary-fixed">
              {stat.value}
            </p>
            <p className="font-label-sm text-label-sm text-surface-variant mt-1">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
