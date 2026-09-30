import Link from "next/link";
import { notFound } from "next/navigation";
import CategoryPropertiesList from "@/components/admin/CategoryPropertiesList";
import { getPropertiesAdmin } from "@/lib/admin-queries";
import { getCategoriesPublic } from "@/lib/queries";
import { uuidSchema } from "@/lib/validation";

export const metadata = {
  title: "Propiedades por categoría · Admin",
};

export default async function AdminCategoryPropertiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const [categories, properties] = await Promise.all([
    getCategoriesPublic(),
    getPropertiesAdmin(),
  ]);
  const category = categories.find((c) => c.id === id);
  if (!category) notFound();

  const inCategory = properties.filter((p) => p.category_id === id);

  return (
    <>
      <p className="mb-4">
        <Link
          href="/admin/categorias"
          className="font-label-sm text-label-sm text-primary hover:text-on-primary-container"
        >
          ← Volver a categorías
        </Link>
      </p>

      <header className="mb-8">
        <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-1">
          {category.name}
        </h1>
        <p className="font-body-md text-body-md text-secondary">
          {inCategory.length} propiedad{inCategory.length === 1 ? "" : "es"} en
          esta categoría.
        </p>
      </header>

      <CategoryPropertiesList
        properties={inCategory.map((p) => ({
          id: p.id,
          title: p.title,
          status: p.status,
          price: p.price,
          currency: p.currency,
          operation: p.operation,
          main_image_url: p.main_image_url,
        }))}
      />
    </>
  );
}
