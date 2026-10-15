import type { Metadata } from "next";
import Image from "next/image";
import AdminLoginForm from "@/components/AdminLoginForm";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {
    title: `Iniciar sesión | ${settings.name}`,
    robots: { index: false, follow: false },
  };
}

export default async function AdminLoginPage() {
  const settings = await getSiteSettings();
  const loginTitle = settings.adminLoginTitle.trim() === "Panel de administración"
    ? "Acceso administrativo"
    : settings.adminLoginTitle;
  const loginSubtitle = settings.adminLoginSubtitle.trim() === "Ingrese sus credenciales para acceder al panel."
    ? `Inicia sesión para gestionar ${settings.name} desde un solo lugar.`
    : settings.adminLoginSubtitle;
  const loginMark = settings.logoUrl && !settings.logoUrl.includes("placehold.co")
    ? settings.logoUrl
    : "/api/favicon";

  return (
    <section className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-surface px-4 py-6 sm:px-6 lg:p-8">
      <div className="pointer-events-none absolute -left-32 top-12 h-72 w-72 rounded-full bg-primary-container/20 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />

      <div className="relative grid min-h-[calc(100svh-3rem)] w-full max-w-6xl overflow-hidden rounded-[2rem] border border-outline-variant/70 bg-surface-container-lowest shadow-[0_24px_80px_rgba(25,28,29,0.14)] lg:grid-cols-[1.04fr_0.96fr]">
        <aside className="relative hidden overflow-hidden bg-secondary px-10 py-12 text-surface lg:flex lg:flex-col lg:justify-between xl:px-14">
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full border-[32px] border-primary-container/20" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl" aria-hidden="true" />

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface p-2 shadow-lg">
                <Image
                  src={loginMark}
                  alt={`${settings.name} logo`}
                  width={64}
                  height={64}
                  unoptimized
                  className="h-full w-full object-contain"
                />
              </span>
              <div className="min-w-0">
                <p className="truncate font-label-sm text-label-sm uppercase tracking-[0.18em] text-primary-fixed">
                  Acceso seguro
                </p>
                <p className="mt-1 truncate font-headline-md text-headline-md text-surface">
                  {settings.name}
                </p>
              </div>
            </div>

            <div className="mt-20 max-w-xl">
              <p className="font-label-md text-label-md uppercase tracking-[0.18em] text-primary-fixed">
                Espacio de trabajo
              </p>
              <h2 className="mt-4 font-headline-xl text-headline-xl text-surface">
                Todo lo que necesita para dirigir su operación inmobiliaria.
              </h2>
              <p className="mt-5 max-w-lg font-body-lg text-body-lg leading-relaxed text-surface/75">
                Administre propiedades, solicitudes, clientes y equipo con una experiencia clara, rápida y preparada para crecer.
              </p>
            </div>

            <div className="mt-12 grid max-w-xl grid-cols-3 gap-3">
              {[
                ["home_work", "Catálogo"],
                ["forum", "Solicitudes"],
                ["groups", "Equipo"],
              ].map(([icon, label]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                  <span className="material-symbols-outlined text-primary-fixed" aria-hidden="true">{icon}</span>
                  <p className="mt-3 font-label-sm text-label-sm text-surface/85">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="relative z-10 mt-12 font-label-sm text-label-sm text-surface/55">
            Panel privado de {settings.name}
          </p>
        </aside>

        <div className="flex items-center px-5 py-8 sm:px-10 sm:py-12 lg:px-14">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface p-1.5 shadow-sm ring-1 ring-outline-variant">
                <Image src={loginMark} alt={`${settings.name} logo`} width={48} height={48} unoptimized className="h-full w-full object-contain" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-label-sm text-label-sm uppercase tracking-[0.16em] text-primary">Acceso seguro</p>
                <p className="truncate font-headline-md text-headline-md text-on-surface">{settings.name}</p>
              </div>
            </div>

            <div className="mb-8">
              <p className="font-label-md text-label-md uppercase tracking-[0.16em] text-primary">Panel privado</p>
              <h1 className="mt-3 font-headline-xl text-headline-xl text-on-surface">{loginTitle}</h1>
              <p className="mt-3 max-w-md font-body-md text-body-md leading-relaxed text-secondary">{loginSubtitle}</p>
            </div>

            <div className="rounded-2xl border border-outline-variant/70 bg-surface-container-low p-5 shadow-sm sm:p-7">
              <AdminLoginForm />
            </div>

            <div className="mt-6 flex items-start gap-2.5 text-sm text-secondary">
              <span className="material-symbols-outlined mt-0.5 text-lg text-primary" aria-hidden="true">verified_user</span>
              <p>Sus credenciales se procesan de forma segura y solo permiten acceder a las funciones autorizadas para su rol.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
