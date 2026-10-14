import Link from "next/link";
import AdminPropertiesTable from "@/components/admin/AdminPropertiesTable";
import { getSession } from "@/lib/auth";
import { getPropertiesAdmin } from "@/lib/admin-queries";

export default async function AdminPropertiesPage() {
  const [properties, session] = await Promise.all([
    getPropertiesAdmin(),
    getSession(),
  ]);
  const canManage = session?.user.role === "admin";

  return (
    <>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-1">
            Propiedades
          </h1>
          <p className="font-body-md text-body-md text-secondary">
            {properties.length} en el catálogo — los cambios se reflejan al
            instante en el sitio público.
          </p>
        </div>
        {canManage ? (
          <Link
            href="/admin/propiedades/nueva"
            className="bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded hover:bg-primary-fixed-dim hover:text-on-primary-fixed transition-colors inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Nueva Propiedad
          </Link>
        ) : null}
      </header>

      <AdminPropertiesTable rows={properties} canManage={canManage} />
    </>
  );
}
