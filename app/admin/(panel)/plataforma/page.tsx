import { redirect } from "next/navigation";
import PlatformControlPanel from "@/components/admin/PlatformControlPanel";
import { getSession } from "@/lib/auth";
import { isTemplateAdminRole } from "@/lib/demo-auth";
import { getPlatformOverview } from "@/lib/platform-queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Panel general · Administración",
};

export default async function PlatformPage() {
  const session = await getSession();
  if (!session || !isTemplateAdminRole(session.user.role)) redirect("/admin/configuracion");
  const overview = await getPlatformOverview();

  return (
    <>
      <header className="mb-8">
        <p className="mb-2 font-label-sm uppercase tracking-[0.16em] text-primary">Control central</p>
        <h1 className="font-headline-lg text-headline-lg-mobile text-on-surface md:text-headline-lg">Panel general del sitio</h1>
        <p className="mt-2 max-w-3xl text-secondary">Administre las empresas, sus accesos y las tareas de mantenimiento desde un único lugar.</p>
      </header>
      <PlatformControlPanel {...overview} />
    </>
  );
}
