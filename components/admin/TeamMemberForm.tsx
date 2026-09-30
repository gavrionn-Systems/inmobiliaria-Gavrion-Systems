"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS, type DemoRole } from "@/lib/demo-auth";
import { updateTeamMember } from "@/lib/team-actions";

const inputClass =
  "bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary outline-none";

export default function TeamMemberForm({
  member,
  isSelf,
}: {
  member: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    role: DemoRole;
    is_active: boolean;
  };
  isSelf: boolean;
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
    const result = await updateTeamMember({
      id: member.id,
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      role: formData.get("role") === "admin" ? "admin" : "agente",
      isActive: formData.get("isActive") === "on",
      password: String(formData.get("password") ?? ""),
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
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
            defaultValue={member.full_name}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 font-label-sm text-label-sm text-secondary">
          Email
          <input
            name="email"
            type="email"
            required
            maxLength={160}
            defaultValue={member.email}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 font-label-sm text-label-sm text-secondary">
          Teléfono
          <input
            name="phone"
            type="tel"
            maxLength={40}
            defaultValue={member.phone ?? ""}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 font-label-sm text-label-sm text-secondary">
          Rol
          <select name="role" defaultValue={member.role} className={inputClass}>
            {(Object.keys(ROLE_LABELS) as DemoRole[]).map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 font-label-sm text-label-sm text-on-surface sm:col-span-2">
          <input
            name={isSelf ? undefined : "isActive"}
            type="checkbox"
            defaultChecked={member.is_active}
            disabled={isSelf}
            className="size-4 accent-primary"
          />
          Cuenta activa (puede entrar al panel)
        </label>
        {isSelf ? <input type="hidden" name="isActive" value="on" /> : null}
        <label className="flex flex-col gap-1 font-label-sm text-label-sm text-secondary sm:col-span-2">
          Nueva contraseña (opcional)
          <input
            name="password"
            type="password"
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            placeholder="Dejar en blanco para no cambiarla"
            className={inputClass}
          />
        </label>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 bg-error-container text-on-error-container rounded p-3 font-body-md text-body-md"
        >
          {error}
        </p>
      )}
      {saved && !error && (
        <p role="status" className="mt-4 font-label-sm text-label-sm text-primary">
          Cambios guardados.
        </p>
      )}

      <div className="mt-5 flex justify-end">
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
