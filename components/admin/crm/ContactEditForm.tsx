"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignContact, clearContactSuppression, optOutContact, updateContact } from "@/lib/crm-actions";

type Profile = { id: string; full_name: string };

const STATUS_OPTIONS = [
  { value: "lead", label: "Lead" },
  { value: "prospecto", label: "Prospecto" },
  { value: "cliente", label: "Cliente" },
  { value: "inactivo", label: "Inactivo" },
] as const;

export default function ContactEditForm({
  contact,
  profiles,
  canAssign,
  suppressed,
}: {
  contact: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    notes: string | null;
    status: string;
    assigned_to: string | null;
  };
  profiles: Profile[];
  canAssign: boolean;
  suppressed: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(formData: FormData) {
    setSaving(true);
    setError(null);
    setSaved(false);
    const status = String(formData.get("status") ?? "lead");
    const result = await updateContact({
      id: contact.id,
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      status: (["lead", "prospecto", "cliente", "inactivo"].includes(status)
        ? status
        : "lead") as "lead" | "prospecto" | "cliente" | "inactivo",
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
    startTransition(() => router.refresh());
  }

  async function reassign(assigneeId: string) {
    setError(null);
    const result = await assignContact(contact.id, assigneeId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  async function optOut() {
    if (
      !window.confirm(
        "¿Registrar que este contacto no desea recibir más mensajes?"
      )
    ) {
      return;
    }
    setError(null);
    const result = await optOutContact(contact.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <form
      action={submit}
      className="border border-outline-variant rounded-lg bg-surface-container-lowest p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 font-label-sm text-label-sm text-secondary">
          Nombre completo
          <input
            name="fullName"
            required
            minLength={2}
            maxLength={120}
            defaultValue={contact.full_name}
            className="bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 font-label-sm text-label-sm text-secondary">
          Estado
          <select
            name="status"
            defaultValue={contact.status}
            className="bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary outline-none"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 font-label-sm text-label-sm text-secondary">
          Email
          <input
            name="email"
            type="email"
            maxLength={160}
            defaultValue={contact.email ?? ""}
            className="bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 font-label-sm text-label-sm text-secondary">
          Teléfono
          <input
            name="phone"
            maxLength={40}
            defaultValue={contact.phone ?? ""}
            className="bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary outline-none"
          />
        </label>
        <label className="sm:col-span-2 flex flex-col gap-1 font-label-sm text-label-sm text-secondary">
          Notas internas
          <textarea
            name="notes"
            rows={3}
            maxLength={4000}
            defaultValue={contact.notes ?? ""}
            className="bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary outline-none resize-y"
          />
        </label>
      </div>

      {canAssign && (
        <label className="mt-4 flex flex-col gap-1 font-label-sm text-label-sm text-secondary sm:max-w-xs">
          Responsable
          <select
            defaultValue={contact.assigned_to ?? ""}
            disabled={pending}
            onChange={(event) => reassign(event.target.value)}
            className="bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary outline-none"
          >
            <option value="">Sin asignar</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.full_name}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && (
        <p role="alert" className="mt-4 bg-error-container text-on-error-container rounded p-3 font-body-md text-body-md">
          {error}
        </p>
      )}
      {saved && !error && (
        <p role="status" className="mt-4 font-label-sm text-label-sm text-primary">
          Cambios guardados.
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        {suppressed ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-error-container px-3 py-1 font-label-sm text-label-sm text-on-error-container">
              En lista de supresión: no recibe mensajes
            </span>
            {canAssign && (
              <button
                type="button"
                disabled={pending}
                onClick={async () => {
                  if (
                    !window.confirm(
                      "¿Quitar a este contacto de la lista de supresión?"
                    )
                  ) {
                    return;
                  }
                  setError(null);
                  const result = await clearContactSuppression(contact.id);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  startTransition(() => router.refresh());
                }}
                className="px-3 py-2 font-label-md text-label-md text-primary hover:bg-primary-container rounded"
              >
                Quitar baja
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={optOut}
            className="px-3 py-2 font-label-md text-label-md text-error hover:bg-error-container rounded transition-colors disabled:opacity-50"
          >
            Registrar baja de mensajes
          </button>
        )}
        <button
          type="submit"
          disabled={saving || pending}
          className="bg-primary text-on-primary rounded px-5 py-2.5 font-label-md text-label-md disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
