import { redirect } from "next/navigation";
import PropertyForm from "@/components/admin/PropertyForm";
import { getSession } from "@/lib/auth";
import { getCategoriesPublic } from "@/lib/queries";

export const metadata = {
  title: "Nueva Propiedad · Admin",
};

export default async function NewPropertyPage() {
  const session = await getSession();
  if (!session || session.user.role !== "admin") {
    redirect("/admin/propiedades?error=forbidden");
  }

  const categories = await getCategoriesPublic();

  return (
    <>
      <header className="mb-8">
        <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
          Nueva Propiedad
        </h1>
        <p className="font-body-md text-body-md text-secondary">
          Llene el formulario; al guardar podrá publicarla para que aparezca en
          el sitio.
        </p>
      </header>

      <PropertyForm categories={categories} />
    </>
  );
}
