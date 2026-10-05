import type { Metadata } from "next";
import { getMapEmbedUrl } from "@/lib/map-embed";
import { getPropertyBySlug } from "@/lib/queries";
import { getSiteSettings } from "@/lib/site-settings";
import ContactTabs from "@/components/ContactTabs";
import { getSiteSchedule, type WorkHours } from "@/lib/schedule";

function formatScheduleLabel(workHours: WorkHours): string {
  const format = (value: string) => value.replace(/^0/, "");
  const range = (value: { start: string; end: string } | null) =>
    value ? `${format(value.start)}–${format(value.end)}` : "cerrado";
  const weekdays = [workHours.mon, workHours.tue, workHours.wed, workHours.thu, workHours.fri];
  const sameWeekdayHours = weekdays.every(
    (day) => day?.start === weekdays[0]?.start && day?.end === weekdays[0]?.end
  );
  const weekdayLabel = sameWeekdayHours
    ? `Lun–Vie ${range(workHours.mon)}`
    : weekdays
        .map((day, index) => `${["Lun", "Mar", "Mié", "Jue", "Vie"][index]} ${range(day)}`)
        .join(" · ");
  const saturdayLabel = workHours.sat ? `Sáb ${range(workHours.sat)}` : "Sáb cerrado";
  return `${weekdayLabel} · ${saturdayLabel}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const base = settings.url.replace(/\/$/, "");
  const title = `Contacto | ${settings.name}`;
  const description = `Contáctenos para comprar, vender o publicar su propiedad en ${settings.address.line1}.`;
  return {
    title,
    description,
    alternates: { canonical: `${base}/contacto` },
    openGraph: {
      title,
      description,
      url: `${base}/contacto`,
      images: [{ url: settings.heroImageUrl, width: 1200, height: 630, alt: settings.name }],
    },
    twitter: { card: "summary_large_image", title, description, images: [settings.heroImageUrl] },
  };
}

export default async function ContactoPage({
  searchParams,
}: {
  searchParams: Promise<{ propiedad?: string }>;
}) {
  const { propiedad } = await searchParams;
  const settings = await getSiteSettings();
  const [prefilled, mapEmbedUrl, schedule] = await Promise.all([
    propiedad ? getPropertyBySlug(propiedad) : Promise.resolve(null),
    getMapEmbedUrl(settings.mapUrl),
    getSiteSchedule(),
  ]);
  const scheduleLabel = formatScheduleLabel(schedule.work_hours);

  const contactoJsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: settings.name,
    url: settings.url,
    telephone: settings.phone,
    email: settings.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.address.line1,
      addressLocality: settings.address.city,
      addressCountry: settings.address.country,
    },
    openingHours: settings.hours,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(contactoJsonLd) }} />
      <section className="pt-20 pb-stack-lg max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
      {/* Impeccable header — editorial, not card */}
      <div className="relative overflow-hidden rounded-[20px] bg-inverse-surface text-inverse-on-surface px-6 md:px-10 py-8 md:py-10 mb-8 md:mb-10 border border-white/10">
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-primary-container/20 blur-3xl" aria-hidden />
        <div className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full bg-primary/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 backdrop-blur">
              <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse" aria-hidden />
              <span className="font-label-sm text-label-sm text-inverse-on-surface/90 tracking-widest">{settings.contactEyebrow}</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-inverse-on-surface mt-4 tracking-tight" style={{ letterSpacing: "-0.03em" }}>
              {settings.contactTitle}
            </h1>
            <p className="font-body-lg text-body-lg text-inverse-on-surface/70 mt-3 max-w-xl leading-relaxed">
              {settings.contactSubtitle}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-surfaceContainerLowest/0 border border-white/15 px-4 py-2.5 backdrop-blur">
              <span className="material-symbols-outlined text-primary-fixed-dim text-[18px]" aria-hidden>schedule</span>
              <span className="font-label-sm text-label-sm text-inverse-on-surface/90">{scheduleLabel}</span>
            </div>
            <a
              href={`https://wa.me/${settings.phone.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-full bg-primary-container text-on-primary-container px-5 py-3 font-label-md text-label-md hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>chat</span>
              WhatsApp
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-stack-lg">
        <div className="order-2 lg:order-1 lg:col-span-4 bg-surface-container-lowest rounded-[16px] p-6 md:p-7 flex flex-col gap-6 border border-outline-variant shadow-[0_8px_32px_rgba(0,0,0,0.06)] h-fit lg:sticky lg:top-24">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container shrink-0" aria-hidden>
              <span className="material-symbols-outlined text-[18px]">location_on</span>
            </span>
            <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">Información</h2>
            <span className="ml-auto font-label-sm text-label-sm text-secondary bg-surface-container border border-outline-variant rounded-full px-2.5 py-1">Ubicación</span>
          </div>

          <div className="space-y-5">
            <a href={settings.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address.line1)}`} target="_blank" rel="noopener" className="flex gap-3 group">
              <span className="w-9 h-9 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center text-secondary group-hover:border-primary-container group-hover:text-primary transition-colors shrink-0" aria-hidden>
                <span className="material-symbols-outlined text-[18px]">place</span>
              </span>
              <div>
                <p className="font-label-sm text-label-sm text-secondary">Dirección</p>
                <p className="font-body-md text-body-md text-on-surface group-hover:text-primary transition-colors">
                  {settings.address.line1}
                  {settings.address.line2 ? (
                    <>
                      <br />
                      {settings.address.line2}
                    </>
                  ) : null}
                  {settings.address.city || settings.address.country ? (
                    <>
                      <br />
                      {[settings.address.city, settings.address.country].filter(Boolean).join(", ")}
                    </>
                  ) : null}
                </p>
              </div>
            </a>

            <a href={`tel:${settings.phone.replace(/[^0-9+]/g, "")}`} className="flex gap-3 group">
              <span className="w-9 h-9 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center text-secondary group-hover:border-primary-container group-hover:text-primary transition-colors shrink-0" aria-hidden>
                <span className="material-symbols-outlined text-[18px]">call</span>
              </span>
              <div>
                <p className="font-label-sm text-label-sm text-secondary">Teléfono</p>
                <p className="font-body-md text-body-md text-on-surface group-hover:text-primary transition-colors font-medium">{settings.phone}</p>
                <p className="font-body-md text-body-md text-secondary text-xs">Toque para llamar</p>
              </div>
            </a>

            <a href={`mailto:${settings.email}`} className="flex gap-3 group">
              <span className="w-9 h-9 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center text-secondary group-hover:border-primary-container group-hover:text-primary transition-colors shrink-0" aria-hidden>
                <span className="material-symbols-outlined text-[18px]">mail</span>
              </span>
              <div>
                <p className="font-label-sm text-label-sm text-secondary">Email</p>
                <p className="font-body-md text-body-md text-on-surface group-hover:text-primary transition-colors break-all">{settings.email}</p>
              </div>
            </a>

            <div className="flex gap-3">
              <span className="w-9 h-9 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center text-secondary shrink-0" aria-hidden>
                <span className="material-symbols-outlined text-[18px]">schedule</span>
              </span>
              <div>
                <p className="font-label-sm text-label-sm text-secondary">Horario laboral</p>
                <p className="font-body-md text-body-md text-on-surface whitespace-pre-line text-sm leading-relaxed">{settings.hours}</p>
                <span className="inline-flex items-center gap-1.5 mt-2 rounded-full bg-primary-container/15 border border-primary-container/30 px-2.5 py-1 font-label-sm text-[11px] tracking-wide text-on-surface">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden /> Buffer {schedule.buffer_minutes}′ entre reuniones
                </span>
              </div>
            </div>
          </div>

          <div className="relative h-48 rounded-xl overflow-hidden border border-outline-variant shadow-sm group">
            {mapEmbedUrl ? (
              <iframe
                src={mapEmbedUrl}
                title={`Mapa de ubicación de ${settings.name}`}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0 w-full h-full border-0 grayscale-[0.15] group-hover:grayscale-0 transition-all duration-300"
              />
            ) : (
              <div className="absolute inset-0 bg-surface-container-low flex flex-col items-center justify-center gap-3 text-center px-6">
                <span className="material-symbols-outlined text-4xl text-primary" aria-hidden>
                  map
                </span>
                <p className="font-label-md text-label-md text-on-surface">
                  {settings.address.city || settings.address.country || "Ubicación principal"}
                </p>
                <p className="font-body-md text-body-md text-secondary text-sm">
                  Configure un enlace de Google Maps válido para mostrar el mapa aquí.
                </p>
              </div>
            )}
            <a
              href={settings.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address.line1)}`}
              target="_blank"
              rel="noopener"
              className="absolute bottom-3 left-3 right-3 rounded-full bg-surfaceContainerLowest/95 backdrop-blur border border-outline-variant px-3 py-2 flex items-center justify-between font-label-sm text-label-sm text-on-surface shadow-sm hover:border-primary-container transition-colors"
            >
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]" aria-hidden>open_in_new</span>
                Ver en Google Maps
              </span>
              <span className="text-secondary">{settings.address.city || settings.address.line1}</span>
            </a>
          </div>


        </div>

        <div className="order-1 lg:order-2 lg:col-span-8">
          <ContactTabs
            propertyId={prefilled?.id ?? null}
            allowedDurations={schedule.slot_durations}
            defaultDuration={schedule.slot_duration_default}
            scheduleLabel={scheduleLabel}
            bufferMinutes={schedule.buffer_minutes}
          />
        </div>
      </div>
    </section>
    </>
  );
}
