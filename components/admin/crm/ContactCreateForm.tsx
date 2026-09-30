"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createContact } from "@/lib/crm-actions";

export default function ContactCreateForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createContact({
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
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
        Nuevo contacto
      </button>
    );
  }

  return (
    <form
      action={submit}
      className="basis-full border border-outline-variant rounded-lg bg-surface-container-low p-4"
    >
      <div className="grid gap-3 md:grid-cols-3">
        <label className="font-label-sm text-label-sm text-secondary">
          Nombre
          <input
            name="fullName"
            required
            minLength={2}
            className="mt-1 w-full bg-surface rounded border border-outline-variant px-3 py-2.5 text-on-surface focus:border-primary outline-none"
          />
        </label>
        <label className="font-label-sm text-label-sm text-secondary">
          Email
          <input
            name="email"
            type="email"
            className="mt-1 w-full bg-surface rounded border border-outline-variant px-3 py-2.5 text-on-surface focus:border-primary outline-none"
          />
        </label>
        <label className="font-label-sm text-label-sm text-secondary">
          Teléfono
          <input
            name="phone"
            type="tel"
            className="mt-1 w-full bg-surface rounded border border-outline-variant px-3 py-2.5 text-on-surface focus:border-primary outline-none"
          />
        </label>
      </div>
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
          {pending ? "Guardando…" : "Guardar contacto"}
        </button>
      </div>
    </form>
  );
}
