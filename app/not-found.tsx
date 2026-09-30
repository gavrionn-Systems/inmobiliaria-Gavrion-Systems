import Link from "next/link";

export default function NotFound() {
  return (
    <section className="min-h-[70vh] flex items-center justify-center pt-24 pb-stack-lg">
      <div className="text-center max-w-md px-margin-mobile">
        <p className="font-headline-xl text-headline-xl text-primary mb-2">
          404
        </p>
        <h1 className="font-headline-md text-headline-md text-on-surface mb-4">
          Propiedad no encontrada
        </h1>
        <p className="font-body-md text-body-md text-secondary mb-8">
          La propiedad que busca no existe o ya no está disponible.
        </p>
        <Link
          href="/propiedades"
          className="bg-primary text-on-primary font-label-md text-label-md px-8 py-3 rounded hover:bg-primary-fixed-dim hover:text-on-primary-fixed transition-colors"
        >
          Ver todas las propiedades
        </Link>
      </div>
    </section>
  );
}