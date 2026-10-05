import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
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
      <AdminSidebar
        items={[...nav]}
        title={panelTitle}
        panelLabel={settings.adminPanelLabel}
        menuLabel={settings.adminMenuLabel}
        logoUrl={settings.logoUrl}
        siteName={settings.name}
        userName={session.user.name}
        roleLabel={roleLabel}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Navegación móvil: barra superior + drawer con todos los apartados */}
        <AdminMobileNav
          items={[...nav]}
          title={panelTitle}
          panelLabel={settings.adminPanelLabel}
          menuLabel={settings.adminMenuLabel}
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
