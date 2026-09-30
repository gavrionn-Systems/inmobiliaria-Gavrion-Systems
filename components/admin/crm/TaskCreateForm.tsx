"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTask } from "@/lib/crm-actions";

export default function TaskCreateForm({
  contacts,
  opportunities,
}: {
  contacts: { id: string; full_name: string }[];
  opportunities: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setLoading(true);
    setError(null);
    const localDueAt = String(formData.get("dueAt") ?? "");
    const result = await createTask({
      contactId: String(formData.get("contactId") ?? ""),
      title: String(formData.get("title") ?? ""),
      dueAt: localDueAt ? new Date(localDueAt).toISOString() : "",
      opportunityId: String(formData.get("opportunityId") ?? ""),
      description: String(formData.get("description") ?? ""),
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        disabled={!contacts.length}
        onClick={() => setOpen(true)}
        className="bg-primary text-on-primary px-5 py-2.5 rounded font-label-md text-label-md disabled:opacity-50"
      >
        Nueva tarea
      </button>
    );
  }

  return (
    <form
      action={submit}
      className="basis-full border border-outline-variant rounded-lg p-4 bg-surface-container-low"
    >
      <div className="grid gap-3 md:grid-cols-3">
        <input
          name="title"
          required
          placeholder="Próxima acción"
          className="bg-surface rounded border border-outline-variant px-3 py-2.5 focus:border-primary outline-none"
        />
        <select
          name="contactId"
          required
          className="bg-surface rounded border border-outline-variant px-3 py-2.5"
        >
          <option value="">Contacto</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.full_name}
            </option>
          ))}
        </select>
        <input
          name="dueAt"
          type="datetime-local"
          className="bg-surface rounded border border-outline-variant px-3 py-2.5"
        />
        <select
          name="opportunityId"
          aria-label="Oportunidad relacionada"
          className="bg-surface rounded border border-outline-variant px-3 py-2.5"
        >
          <option value="">Sin oportunidad relacionada</option>
          {opportunities.map((opportunity) => (
            <option key={opportunity.id} value={opportunity.id}>
              {opportunity.title}
            </option>
          ))}
        </select>
        <textarea
          name="description"
          rows={2}
          maxLength={2000}
          placeholder="Descripción (opcional)"
          className="bg-surface rounded border border-outline-variant px-3 py-2.5 resize-y md:col-span-2"
        />
      </div>
      {error && (
        <p role="alert" className="mt-3 text-on-error-container">
          {error}
        </p>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2 text-secondary"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="bg-primary text-on-primary rounded px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
