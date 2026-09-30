import Link from "next/link";
import { getDashboardStats } from "@/lib/admin-queries";
import { getSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/demo-auth";

export default async function AdminDashboardPage(props: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const [stats, session] = await Promise.all([
    getDashboardStats(),
    getSession(),
  ]);
  const isAdmin = isAdminRole(session?.user.role ?? "agente");
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const forbidden = searchParams?.error === "forbidden";

  const cards = [
    {
      label: "Propiedades",
      value: String(stats.totalProperties),
      icon: "home_work",
      link: "/admin/propiedades",
      hint: `${stats.published} publicadas`,
    },
    {
      label: "Publicadas",
      value: String(stats.published),
      icon: "visibility",
      link: "/admin/propiedades",
      hint: `${stats.drafts} en borrador`,
    },
    {
      label: "Destacadas",
      value: String(stats.featured),
      icon: "star",
      link: "/admin/propiedades",
      hint: "en la portada",
    },
    {
      label: "Solicitudes",
      value: String(stats.totalInquiries),
      icon: "mail",
      link: "/admin/solicitudes",
      hint: `${stats.unreadInquiries} sin leer`,
    },
    {
      label: "Categorías",
      value: String(stats.totalCategories),
      icon: "category",
      link: "/admin/categorias",
      hint: "del catálogo",
    },
  ];

  return (
    <>
      {forbidden && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-error bg-error-container px-4 py-3 flex items-start gap-3"
        >
          <span className="material-symbols-outlined text-on-error-container">block</span>
          <div>
            <p className="font-label-md text-label-md text-on-error-container">
              No tiene permisos para esa sección.
            </p>
            <p className="font-body-sm text-body-sm text-on-error-container/80">
              Su rol es {isAdmin ? "Administrador" : "Empleado"} — contacte a un administrador si necesita acceso.
            </p>
          </div>
        </div>
      )}
      <header className="mb-8">
        <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-1">
          {isAdmin ? "Panel de administración" : "Panel del equipo"}
        </h1>
        <p className="font-body-md text-body-md text-secondary">
          Bienvenido de vuelta — aquí está el estado de su catálogo.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards
          .filter(
            (card) =>
              isAdmin ||
              card.link !== "/admin/categorias"
          )
          .map((card) => (
          <Link
            key={card.label}
            href={card.link}
            className="group bg-surface-container-low rounded-lg border border-outline-variant p-5 hover:border-primary hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-label-md text-label-md text-secondary mb-1">
                  {card.label}
                </p>
                <p className="font-headline-lg text-headline-lg text-on-surface">
                  {card.value}
                </p>
                <p className="font-label-sm text-label-sm text-secondary mt-1">
                  {card.hint}
                </p>
              </div>
              <span className="material-symbols-outlined text-primary group-hover:fill-primary">
                {card.icon}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {stats.totalProperties === 0 && (
        <div className="mt-8 bg-surface-container-low rounded-lg border border-dashed border-outline-variant p-8 text-center">
          <p className="font-body-md text-body-md text-secondary mb-4">
            El catálogo está vacío. Empiece creando su primera propiedad.
          </p>
          <Link
            href="/admin/propiedades/nueva"
            className="bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded hover:bg-primary-fixed-dim hover:text-on-primary-fixed transition-colors"
          >
            Crear primera propiedad
          </Link>
        </div>
      )}

      {stats.totalInquiries > 0 && (
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Solicitudes recientes
            </h2>
            <Link
              href="/admin/solicitudes"
              className="font-label-md text-label-md text-primary hover:text-primary-fixed-dim"
            >
              Ver todas
            </Link>
          </div>
          <div className="bg-surface-container-low rounded-lg border border-outline-variant divide-y divide-outline-variant/60">
            {stats.recentInquiries.map((inq) => (
              <div
                key={inq.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-label-md text-label-md text-on-surface truncate">
                    {inq.name} — {inq.property_title ?? "Consulta general"}
                  </p>
                  <p className="font-label-sm text-label-sm text-secondary truncate">
                    {inq.phone || inq.email} · {new Date(inq.created_at).toLocaleDateString("es")}
                  </p>
                </div>
                <span
                  className={`font-label-sm text-label-sm px-2 py-1 rounded flex-shrink-0 ${
                    inq.status === "nueva"
                      ? "bg-primary-container text-on-primary-container"
                      : "bg-surface-container-highest text-secondary"
                  }`}
                >
                  {inq.status === "nueva" ? "Nueva" : "En proceso"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}