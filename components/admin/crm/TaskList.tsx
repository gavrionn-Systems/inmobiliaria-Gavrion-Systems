"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignTask, setTaskStatus, updateTask } from "@/lib/crm-actions";
import { formatDate } from "@/lib/format";

type Task = {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  status: string;
  assigned_to: string;
  contact: { full_name: string } | null;
  opportunity: { title: string } | null;
  assignee: { full_name: string } | null;
  is_overdue: boolean;
};

type Profile = { id: string; full_name: string };

function toDatetimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function TaskList({
  tasks,
  profiles,
  canAssign,
}: {
  tasks: Task[];
  profiles: Profile[];
  canAssign: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function run(action: Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    const result = await action;
    if (!result.ok) {
      setError(result.error ?? "No se pudo guardar.");
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  async function change(
    task: Task,
    status: "pendiente" | "completada" | "cancelada"
  ) {
    await run(setTaskStatus(task.id, status));
  }

  async function toggle(task: Task) {
    await change(task, task.status === "completada" ? "pendiente" : "completada");
  }

  async function saveEdit(task: Task, formData: FormData) {
    const localDueAt = String(formData.get("dueAt") ?? "");
    const ok = await run(
      updateTask({
        id: task.id,
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        dueAt: localDueAt ? new Date(localDueAt).toISOString() : "",
      })
    );
    if (ok) setEditingId(null);
  }

  if (tasks.length === 0) {
    return (
      <div className="border border-dashed border-outline-variant rounded-lg p-10 text-center">
        <h2 className="font-headline-md text-headline-md">Sin tareas pendientes</h2>
        <p className="mt-2 text-secondary">
          Las próximas acciones de seguimiento aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-4 bg-error-container text-on-error-container p-3 rounded">
          {error}
        </p>
      )}
      <div className="border border-outline-variant rounded-lg bg-surface-container-lowest divide-y divide-outline-variant">
        {tasks.map((task) => {
          const overdue = task.is_overdue;
          return (
            <article key={task.id} className="flex items-start gap-3 px-4 py-4">
              <input
                type="checkbox"
                checked={task.status === "completada"}
                disabled={pending}
                onChange={() => toggle(task)}
                aria-label={`Marcar ${task.title} como ${
                  task.status === "completada" ? "pendiente" : "completada"
                }`}
                className="mt-1 h-5 w-5 accent-primary"
              />
              <div className="min-w-0 flex-1">
                {editingId === task.id ? (
                  <form
                    action={(formData) => saveEdit(task, formData)}
                    className="grid gap-2"
                  >
                    <input
                      name="title"
                      required
                      defaultValue={task.title}
                      className="bg-surface rounded border border-outline-variant px-3 py-2 font-body-md text-body-md"
                    />
                    <textarea
                      name="description"
                      rows={2}
                      defaultValue={task.description ?? ""}
                      className="bg-surface rounded border border-outline-variant px-3 py-2 font-body-md text-body-md"
                    />
                    <input
                      name="dueAt"
                      type="datetime-local"
                      defaultValue={toDatetimeLocal(task.due_at)}
                      className="bg-surface rounded border border-outline-variant px-3 py-2 font-body-md text-body-md"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={pending}
                        className="bg-primary text-on-primary rounded px-3 py-1.5 font-label-sm text-label-sm"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 font-label-sm text-label-sm text-secondary"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2
                        className={`font-label-md text-label-md ${
                          task.status === "completada"
                            ? "line-through text-secondary"
                            : "text-on-surface"
                        }`}
                      >
                        {task.title}
                      </h2>
                      {overdue && (
                        <span className="rounded-full bg-error-container px-2 py-0.5 font-label-sm text-label-sm text-on-error-container">
                          Vencida
                        </span>
                      )}
                      {task.status === "cancelada" && (
                        <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
                          Cancelada
                        </span>
                      )}
                    </div>
                    {task.description && (
                      <p className="mt-1 font-body-md text-body-md text-secondary">
                        {task.description}
                      </p>
                    )}
                    <p className="mt-2 font-label-sm text-label-sm text-on-surface-variant">
                      {task.contact?.full_name ??
                        task.opportunity?.title ??
                        "Seguimiento general"}
                      {" · "}
                      {task.assignee?.full_name ?? "Sin responsable"}
                      {task.due_at ? ` · ${formatDate(task.due_at)}` : ""}
                    </p>
                  </>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                {canAssign && (
                  <select
                    value={task.assigned_to}
                    disabled={pending}
                    aria-label={`Asignar ${task.title}`}
                    onChange={(event) =>
                      run(assignTask(task.id, event.target.value))
                    }
                    className="bg-surface rounded border border-outline-variant px-2 py-1 font-label-sm text-label-sm"
                  >
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.full_name}
                      </option>
                    ))}
                  </select>
                )}
                {editingId !== task.id && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setEditingId(task.id)}
                    className="px-2 py-1 font-label-sm text-label-sm text-primary hover:text-on-primary-container disabled:opacity-50"
                  >
                    Editar
                  </button>
                )}
                {task.status === "pendiente" ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => change(task, "cancelada")}
                    className="px-2 py-1 font-label-sm text-label-sm text-secondary hover:text-error transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                ) : task.status === "cancelada" ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => change(task, "pendiente")}
                    className="px-2 py-1 font-label-sm text-label-sm text-secondary hover:text-primary transition-colors disabled:opacity-50"
                  >
                    Reabrir
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
