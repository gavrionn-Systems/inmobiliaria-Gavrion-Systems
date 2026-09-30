"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOpportunity } from "@/lib/crm-actions";

export default function OpportunityCreateForm({
  contacts,
  stages,
  properties,
  defaultStageId,
}: {
  contacts: { id: string; full_name: string }[];
  stages: { id: string; name: string }[];
  properties: { id: string; title: string }[];
  defaultStageId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await createOpportunity({
      contactId: String(formData.get("contactId") ?? ""),
      stageId: String(formData.get("stageId") ?? ""),
      title: String(formData.get("title") ?? ""),
      value: String(formData.get("value") ?? ""),
      currency: formData.get("currency") === "HNL" ? "HNL" : "USD",
      propertyId: String(formData.get("propertyId") ?? ""),
      expectedCloseAt: String(formData.get("expectedCloseAt") ?? ""),
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
      <span className="flex items-center gap-2">
        {!contacts.length && (
          <span className="font-label-sm text-label-sm text-secondary">
            Crea un contacto primero.
          </span>
        )}
        <button
          type="button"
          disabled={!contacts.length || !stages.length}
          onClick={() => setOpen(true)}
          className="bg-primary text-on-primary px-5 py-2.5 rounded font-label-md text-label-md disabled:opacity-50"
        >
          Nueva oportunidad
        </button>
      </span>
    );
  }

  return (
    <form action={submit} className="basis-full border border-outline-variant rounded-lg p-4 bg-surface-container-low">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <input
          name="title"
          required
          placeholder="Nombre de la oportunidad"
          className="bg-surface rounded border border-outline-variant px-3 py-2.5 focus:border-primary outline-none xl:col-span-2"
        />
        <select name="contactId" required className="bg-surface rounded border border-outline-variant px-3 py-2.5">
          <option value="">Contacto</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>{contact.full_name}</option>
          ))}
        </select>
        <select name="stageId" required defaultValue={defaultStageId} className="bg-surface rounded border border-outline-variant px-3 py-2.5">
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>{stage.name}</option>
          ))}
        </select>
        <div className="flex">
          <input name="value" type="number" min="0" placeholder="Valor" className="min-w-0 flex-1 bg-surface rounded-l border border-outline-variant px-3 py-2.5" />
          <select name="currency" className="bg-surface rounded-r border-y border-r border-outline-variant px-2">
            <option value="USD">USD</option>
            <option value="HNL">HNL</option>
          </select>
        </div>
        <select
          name="propertyId"
          aria-label="Propiedad relacionada"
          className="bg-surface rounded border border-outline-variant px-3 py-2.5 xl:col-span-2"
        >
          <option value="">Sin propiedad relacionada</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>{property.title}</option>
          ))}
        </select>
        <label className="flex flex-col gap-1 font-label-sm text-label-sm text-secondary xl:col-span-2">
          Cierre estimado
          <input
            name="expectedCloseAt"
            type="date"
            className="bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface"
          />
        </label>
      </div>
      {error && <p role="alert" className="mt-3 text-on-error-container">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-secondary">Cancelar</button>
        <button type="submit" disabled={loading} className="bg-primary text-on-primary rounded px-4 py-2 disabled:opacity-50">
          {loading ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
