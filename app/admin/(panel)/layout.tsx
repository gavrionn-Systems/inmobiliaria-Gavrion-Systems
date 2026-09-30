import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import AdminLogoutButton from "@/components/AdminLogoutButton";
import AdminMobileNav from "@/components/admin/AdminMobileNav";
import { getSession } from "@/lib/auth";
import {
  ADMIN_ONLY_NAV_KEYS,
  ROLE_LABELS,
  adminLoginPath,
  isAdminRole,
  isTemplateAdminRole,
} from "@/lib/demo-auth";
import { adminNav } from "@/lib/site";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    // Defensa en profundidad: el proxy ya bloquea, pero si se renderiza sin
    // sesión (p. ej. proxy desactivado), redirigir al login secreto.
    redirect(adminLoginPath());
  }
  const settings = await getSiteSettings();
  const role = session.user.role;
  const adminOnlyNav = new Set<string>([
    ...ADMIN_ONLY_NAV_KEYS,
    "configuracion",
  ]);
  const nav = isTemplateAdminRole(role)
    ? adminNav.filter((item) => item.key === "configuracion")
    : isAdminRole(role)
      ? adminNav
      : adminNav.filter((item) => !adminOnlyNav.has(item.key));
  const panelTitle = isTemplateAdminRole(role)
    ? "Configuración de plantilla"
    : isAdminRole(role)
      ? "Panel Admin"
      : "Panel del equipo";
  const roleLabel = ROLE_LABELS[role] ?? role;

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Barra lateral */}
      <aside className="w-64 bg-secondary hidden md:flex flex-col sticky top-0 h-screen">
        <Link
          href="/admin"
          aria-label={settings.name}
          className="flex items-center gap-3 px-6 py-5 border-b border-white/10"
        >
          <span className="brand-logo-mark" aria-hidden="true">
            <span className="brand-logo-disc">
              <Image
                src={settings.logoUrl}
                alt=""
                width={36}
                height={36}
                priority
                className="h-full w-full object-contain"
              />
            </span>
          </span>
          <span className="font-headline-md text-headline-md text-surface text-base">
            {panelTitle}
          </span>
        </Link>

        {/* Usuario demo */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary-container text-lg">
              person
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-label-md text-label-md text-surface font-bold truncate">
              {session?.user.name}
            </p>
            <p className="font-label-sm text-label-sm text-surface-variant truncate">
              {roleLabel}
            </p>
          </div>
        </div>

        <nav className="flex flex-col py-4 flex-1" aria-label="Admin">
          <p className="px-6 pb-2 font-label-sm text-label-sm text-surface-variant uppercase tracking-wider">
            Gestión
          </p>
          {nav.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="px-6 py-3 font-label-md text-label-md text-surface-variant hover:bg-white/10 hover:text-surface transition-colors"
            >
              {item.label}
            </Link>
          ))}
          <AdminLogoutButton />
          <Link
            href="/"
            className="px-6 py-3 font-label-md text-label-md text-surface-variant hover:bg-white/10 hover:text-surface transition-colors"
          >
            Ver sitio público
          </Link>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Navegación móvil: barra superior + drawer con todos los apartados */}
        <AdminMobileNav
          items={[...nav]}
          title={panelTitle}
          logoUrl={settings.logoUrl}
          siteName={settings.name}
          userName={session?.user.name}
          roleLabel={roleLabel}
        />

        <main className="flex-1 p-4 md:p-6 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
