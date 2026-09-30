import Link from "next/link";
import TaskList from "@/components/admin/crm/TaskList";
import TaskCreateForm from "@/components/admin/crm/TaskCreateForm";
import { getProfiles } from "@/lib/admin-queries";
import { getSession } from "@/lib/auth";
import { getCrmCreationOptions, getCrmTasks } from "@/lib/crm-queries";

export const metadata = { title: "Tareas CRM · Admin" };

function param(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default async function CrmTasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = {
    status: param(params.estado),
    assignee: param(params.responsable),
  };
  const [tasks, options, session, profiles] = await Promise.all([
    getCrmTasks(filters),
    getCrmCreationOptions(),
    getSession(),
    getProfiles(),
  ]);
  const isAdmin = session?.user.role === "admin";
  const activeProfiles = profiles.filter((profile) => profile.is_active);
  const hasFilters = Boolean(filters.status || filters.assignee);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-1">
            Tareas
          </h1>
          <p className="font-body-md text-body-md text-secondary">
            Próximas acciones y seguimientos del equipo.
          </p>
        </div>
        <TaskCreateForm
          contacts={options.contacts}
          opportunities={options.opportunities}
        />
      </header>

      <form
        method="get"
        className="mb-6 grid gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-4 sm:grid-cols-3"
      >
        <label className="flex flex-col gap-1 font-label-sm text-label-sm text-secondary">
          Estado
          <select
            name="estado"
            defaultValue={filters.status}
            className="bg-surface rounded border border-outline-variant px-3 py-2 font-body-md text-body-md text-on-surface"
          >
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="completada">Completada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 font-label-sm text-label-sm text-secondary">
          Responsable
          <select
            name="responsable"
            defaultValue={filters.assignee}
            className="bg-surface rounded border border-outline-variant px-3 py-2 font-body-md text-body-md text-on-surface"
          >
            <option value="">Todos</option>
            {activeProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.full_name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="bg-primary text-on-primary rounded px-4 py-2 font-label-md text-label-md"
          >
            Filtrar
          </button>
          {hasFilters && (
            <Link
              href="/admin/crm/tareas"
              className="px-3 py-2 font-label-md text-label-md text-secondary"
            >
              Limpiar
            </Link>
          )}
        </div>
      </form>

      <TaskList
        tasks={tasks}
        profiles={activeProfiles.map((profile) => ({
          id: profile.id,
          full_name: profile.full_name,
        }))}
        canAssign={Boolean(isAdmin)}
      />
    </>
  );
}
