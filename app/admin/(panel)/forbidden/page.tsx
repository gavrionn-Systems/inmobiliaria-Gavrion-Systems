import Link from "next/link";

export const metadata = { title: "Acceso denegado · Admin" };

export default function ForbiddenPage() {
  return (
    <div className="max-w-lg mx-auto mt-16 rounded-lg border border-error bg-error-container p-8 text-center">
      <span className="material-symbols-outlined text-on-error-container text-5xl mb-4">block</span>
      <h1 className="font-headline-md text-headline-md text-on-error-container mb-2">Acceso denegado</h1>
      <p className="font-body-md text-body-md text-on-error-container/80 mb-6">
        Su rol de <strong>Empleado</strong> no tiene permisos para esta sección. Solo un <strong>Administrador</strong> puede ver Equipo, Categorías y Configuración.
      </p>
      <Link href="/admin" className="inline-block bg-primary text-on-primary px-6 py-3 rounded font-label-md">
        Volver al panel
      </Link>
    </div>
  );
}
