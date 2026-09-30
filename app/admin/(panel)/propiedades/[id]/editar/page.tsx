import Link from "next/link";
import PropertyForm from "@/components/admin/PropertyForm";
import { getPropertyForEdit } from "@/lib/admin-queries";
import { getCategoriesPublic } from "@/lib/queries";

export const metadata = {
  title: "Editar Propiedad · Admin",
};

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [property, categories] = await Promise.all([
    getPropertyForEdit(id),
    getCategoriesPublic(),
  ]);

  if (!property) {
    return (
      <div className="bg-surface-container-low rounded-lg border border-dashed border-outline-variant p-10 text-center max-w-xl mx-auto mt-16">
        <span className="material-symbols-outlined text-4xl text-secondary mb-3">
          search_off
        </span>
        <h1 className="font-headline-md text-headline-md text-on-surface mb-2">
          Propiedad no encontrada
        </h1>
        <p className="font-body-md text-body-md text-secondary mb-6">
          Puede que haya sido eliminada o que la dirección sea incorrecta.
        </p>
        <Link
          href="/admin/propiedades"
          className="bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded hover:bg-primary-fixed-dim hover:text-on-primary-fixed transition-colors"
        >
          Volver a Propiedades
        </Link>
      </div>
    );
  }

  const locationName =
    (property.locations as { name: string } | null)?.name ?? "";

  return (
    <>
      <header className="mb-8">
        <Link
          href="/admin/propiedades"
          className="font-label-md text-label-md text-secondary hover:text-primary inline-flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Propiedades
        </Link>
        <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mt-2">
          Editar: {property.title}
        </h1>
      </header>

      <PropertyForm
        categories={categories}
        initial={{
          ...property,
          location_name: locationName,
          gallery: [...(property.property_images ?? [])]
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((g) => ({ url: g.url, alt: g.alt_text ?? "" })),
        }}
      />
    </>
  );
}
