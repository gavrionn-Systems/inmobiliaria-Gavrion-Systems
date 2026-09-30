import Image from "next/image";
import Link from "next/link";
import TeamCreateForm from "@/components/admin/TeamCreateForm";
import TeamRecommendations from "@/components/admin/TeamRecommendations";
import { redirect } from "next/navigation";
import {
  getTeamDirectory,
  getTeamRecommendations,
} from "@/lib/admin-queries";
import { getSession } from "@/lib/auth";
import { DEMO_EMPLOYEE, ROLE_LABELS, isAdminRole } from "@/lib/demo-auth";
import { formatDate } from "@/lib/format";

export const metadata = {
  title: "Equipo · Admin",
};

export default async function AdminTeamPage() {
  const session = await getSession();
  if (!session || !isAdminRole(session.user.role)) redirect("/admin?error=forbidden");
  const members = await getTeamDirectory();
  const recommendations = getTeamRecommendations(
    members,
    process.env.EMPLOYEE_EMAIL ?? DEMO_EMPLOYEE.email
  );

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-1">
            Equipo
          </h1>
          <p className="font-body-md text-body-md text-secondary">
            Agentes y administradores con acceso al panel.
          </p>
        </div>
        <TeamCreateForm />
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem] items-start">
        {members.length === 0 ? (
          <div className="bg-surface-container-low rounded-lg border border-dashed border-outline-variant p-10 text-center">
            <span className="material-symbols-outlined text-4xl text-secondary mb-3">
              group_add
            </span>
            <h2 className="font-headline-md text-headline-md text-on-surface mb-2">
              Aún no hay miembros
            </h2>
            <p className="font-body-md text-body-md text-secondary max-w-md mx-auto">
              Cree el primer administrador o empleado con email y una
              contraseña temporal. Aparecerá aquí y podrá entrar al panel.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {members.map((member) => (
              <Link
                key={member.id}
                href={`/admin/equipo/${member.id}`}
                className="bg-surface-container-low rounded-lg border border-outline-variant p-5 hover:border-primary transition-colors"
              >
                <div className="flex items-center gap-3">
                  {member.avatar_url ? (
                    <Image
                      src={member.avatar_url}
                      alt=""
                      width={48}
                      height={48}
                      className="rounded-full bg-surface-container-high object-cover"
                    />
                  ) : (
                    <span className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container font-headline-md flex items-center justify-center">
                      {member.full_name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="font-label-md text-label-md text-on-surface truncate">
                      {member.full_name}
                    </p>
                    <p className="font-label-sm text-label-sm text-secondary truncate">
                      {member.email}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span
                    className={`font-label-sm text-label-sm px-2 py-1 rounded ${
                      member.role === "admin"
                        ? "bg-primary-container text-on-primary-container"
                        : "bg-surface-container-highest text-secondary"
                    }`}
                  >
                    {ROLE_LABELS[member.role] ?? member.role}
                  </span>
                  <span
                    className={`font-label-sm text-label-sm px-2 py-1 rounded ${
                      member.is_active
                        ? "bg-surface-container-highest text-on-surface"
                        : "bg-error-container text-on-error-container"
                    }`}
                  >
                    {member.is_active ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="font-label-sm text-label-sm text-secondary truncate">
                    {member.phone || "Sin teléfono"}
                  </span>
                  <span className="font-label-sm text-label-sm text-secondary shrink-0">
                    Desde {formatDate(member.created_at)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
        <TeamRecommendations items={recommendations} />
      </div>
    </>
  );
}
