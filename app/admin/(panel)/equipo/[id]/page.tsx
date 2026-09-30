import Link from "next/link";
import { notFound } from "next/navigation";
import TeamMemberForm from "@/components/admin/TeamMemberForm";
import { getTeamMember } from "@/lib/admin-queries";
import { getSession } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/demo-auth";
import { formatDate } from "@/lib/format";
import { uuidSchema } from "@/lib/validation";

export const metadata = {
  title: "Miembro del equipo · Admin",
};

export default async function AdminTeamMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const [member, session] = await Promise.all([getTeamMember(id), getSession()]);
  if (!member) notFound();

  const isSelf =
    session?.user.email.trim().toLowerCase() ===
    member.email.trim().toLowerCase();

  return (
    <>
      <p className="mb-4">
        <Link
          href="/admin/equipo"
          className="font-label-sm text-label-sm text-primary hover:text-on-primary-container"
        >
          ← Volver al equipo
        </Link>
      </p>

      <header className="mb-8">
        <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-1">
          {member.full_name}
        </h1>
        <p className="font-body-md text-body-md text-secondary">
          {ROLE_LABELS[member.role]} · {member.email}
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem] items-start">
        <TeamMemberForm member={member} isSelf={isSelf} />

        <aside className="border border-outline-variant rounded-lg bg-surface-container-low p-5 space-y-4">
          <h2 className="font-headline-md text-headline-md text-on-surface text-lg">
            Actividad
          </h2>
          <dl className="space-y-3 font-body-md text-body-md">
            <div>
              <dt className="font-label-sm text-label-sm text-secondary">
                Último acceso
              </dt>
              <dd className="text-on-surface">
                {formatDate(member.last_sign_in_at)}
              </dd>
            </div>
            <div>
              <dt className="font-label-sm text-label-sm text-secondary">
                En el equipo desde
              </dt>
              <dd className="text-on-surface">
                {formatDate(member.created_at)}
              </dd>
            </div>
            <div>
              <dt className="font-label-sm text-label-sm text-secondary">
                Contactos asignados
              </dt>
              <dd className="text-on-surface">{member.contactCount}</dd>
            </div>
            <div>
              <dt className="font-label-sm text-label-sm text-secondary">
                Tareas pendientes
              </dt>
              <dd className="text-on-surface">{member.openTaskCount}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </>
  );
}
