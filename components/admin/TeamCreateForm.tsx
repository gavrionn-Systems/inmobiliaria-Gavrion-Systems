"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTeamMember } from "@/lib/team-actions";

const inputClass =
  "mt-1 w-full bg-surface rounded border border-outline-variant px-3 py-2.5 text-on-surface focus:border-primary outline-none";

export default function TeamCreateForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createTeamMember({
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      role: formData.get("role") === "admin" ? "admin" : "agente",
      password: String(formData.get("password") ?? ""),
    });
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    setOpen(false);
    setPending(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-primary text-on-primary px-5 py-2.5 rounded font-label-md text-label-md hover:bg-primary-fixed-dim hover:text-on-primary-fixed transition-colors"
      >
        Agregar miembro
      </button>
    );
  }

  return (
    <form
      action={submit}
      className="basis-full border border-outline-variant rounded-lg bg-surface-container-low p-4"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="font-label-sm text-label-sm text-secondary">
          Nombre completo
          <input
            name="fullName"
            required
            minLength={2}
            maxLength={120}
            className={inputClass}
          />
        </label>
        <label className="font-label-sm text-label-sm text-secondary">
          Email
          <input
            name="email"
            type="email"
            required
            maxLength={160}
            className={inputClass}
          />
        </label>
        <label className="font-label-sm text-label-sm text-secondary">
          Teléfono
          <input name="phone" type="tel" maxLength={40} className={inputClass} />
        </label>
        <label className="font-label-sm text-label-sm text-secondary">
          Rol
          <select name="role" defaultValue="agente" className={inputClass}>
            <option value="agente">Empleado</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        <label className="font-label-sm text-label-sm text-secondary md:col-span-2 xl:col-span-1">
          Contraseña temporal
          <input
            name="password"
            type="password"
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            className={inputClass}
          />
        </label>
      </div>
      <p className="mt-3 font-label-sm text-label-sm text-secondary">
        El miembro podrá entrar al panel de inmediato con este email y
        contraseña. Entréguele la clave por un canal privado.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-on-error-container text-label-sm">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2 font-label-md text-label-md text-secondary hover:text-on-surface"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-on-primary px-4 py-2 rounded font-label-md text-label-md disabled:opacity-50"
        >
          {pending ? "Creando…" : "Crear miembro"}
        </button>
      </div>
    </form>
  );
}
