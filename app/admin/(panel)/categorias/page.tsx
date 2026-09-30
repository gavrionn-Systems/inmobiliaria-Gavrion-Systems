import { redirect } from "next/navigation";
import CategoriesManager from "@/components/admin/CategoriesManager";
import { getPropertiesAdmin } from "@/lib/admin-queries";
import { getSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/demo-auth";
import { getCategoriesPublic } from "@/lib/queries";

export const metadata = {
  title: "Categorías · Admin",
};

export default async function AdminCategoriesPage() {
  const session = await getSession();
  if (!session || !isAdminRole(session.user.role)) redirect("/admin?error=forbidden");
  const [categories, properties] = await Promise.all([
    getCategoriesPublic(),
    getPropertiesAdmin(),
  ]);

  const counts: Record<string, number> = {};
  for (const p of properties) {
    if (p.category_id) counts[p.category_id] = (counts[p.category_id] ?? 0) + 1;
  }

  return (
    <>
      <header className="mb-8">
        <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-1">
          Categorías
        </h1>
        <p className="font-body-md text-body-md text-secondary">
          Tipos de propiedad disponibles para clasificar el catálogo.
        </p>
      </header>

      <CategoriesManager rows={categories} propertyCounts={counts} />
    </>
  );
}