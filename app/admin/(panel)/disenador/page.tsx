import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { adminPanelSlug, isDesignerRole } from "@/lib/demo-auth";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

type DesignerSite = {
  id: string;
  name: string;
  url: string;
  adminPath?: string;
  isCurrent: boolean;
};

function normalizeUrl(value: string) {
  return value.trim().replace(/\/$/, "").toLowerCase();
}

function adminUrl(site: DesignerSite) {
  const base = site.url.trim().replace(/\/$/, "");
  const path = site.adminPath?.trim().replace(/^\/+|\/+$/g, "");
  return base && path ? `${base}/${path}` : "";
}

export default async function DesignerSitesPage() {
  const session = await getSession();
  if (!session || !isDesignerRole(session.user.role)) {
    redirect("/admin?error=forbidden");
  }

  const settings = await getSiteSettings();
  const currentUrl = normalizeUrl(settings.url);
  const assigned = session.user.assignedCompanies ?? [];
  const sites: DesignerSite[] = assigned.map((company) => ({
    ...company,
    isCurrent: normalizeUrl(company.url) === currentUrl,
  }));

  if (!sites.some((site) => site.isCurrent)) {
    sites.unshift({
      id: "current-site",
      name: settings.name,
      url: settings.url,
      isCurrent: true,
    });
  }

  const panelPath = `/${adminPanelSlug()}`;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <p className="font-label-sm text-label-sm uppercase tracking-[0.16em] text-primary">Modo diseñador</p>
        <h1 className="mt-2 font-headline-lg text-headline-lg-mobile text-on-surface md:text-headline-lg">Mis sitios</h1>
        <p className="mt-2 max-w-3xl font-body-md text-body-md text-secondary">
          Seleccione el sitio que desea revisar. Cada empresa conserva su propia instalación, base de datos y configuración.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2" aria-label="Sitios asignados">
        {sites.map((site) => (
          <article
            key={site.id}
            className={`rounded-xl border p-5 ${site.isCurrent ? "border-primary bg-primary-container/25" : "border-outline-variant bg-surface-container-low"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-headline-sm text-on-surface">{site.name}</p>
                <p className="mt-1 truncate text-sm text-secondary" title={site.url}>{site.url || "URL pendiente de configurar"}</p>
              </div>
              {site.isCurrent ? (
                <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-on-primary">Sitio actual</span>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {site.isCurrent ? (
                <Link
                  href={`${panelPath}/configuracion`}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary hover:bg-primary-fixed-dim hover:text-on-primary-fixed"
                >
                  Configurar este sitio
                  <span aria-hidden="true" className="material-symbols-outlined text-base">settings</span>
                </Link>
              ) : adminUrl(site) ? (
                <a
                  href={adminUrl(site)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface hover:border-primary hover:text-primary"
                >
                  Abrir panel de este sitio
                  <span aria-hidden="true" className="material-symbols-outlined text-base">open_in_new</span>
                </a>
              ) : null}
            </div>

            {!site.isCurrent ? (
              <p className="mt-4 text-sm text-secondary">
                Abrirá el acceso privado de esta instalación. Use las mismas credenciales de diseñador.
              </p>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
