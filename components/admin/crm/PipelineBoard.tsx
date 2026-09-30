"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteOpportunity,
  moveOpportunity,
  setOpportunityStatus,
  updateOpportunity,
} from "@/lib/crm-actions";

type Stage = { id: string; name: string; position: number; is_closed: boolean };
type Opportunity = {
  id: string;
  title: string;
  value: number | null;
  currency: string;
  status: string;
  stage_id: string;
  expected_close_at: string | null;
  property_id: string | null;
  contact: { id: string; full_name: string } | null;
  property: { id: string; title: string; slug: string } | null;
  assignee: { full_name: string } | null;
};

export default function PipelineBoard({
  stages,
  opportunities,
  includeClosed,
  isAdmin,
}: {
  stages: Stage[];
  opportunities: Opportunity[];
  includeClosed: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);

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

  async function save(item: Opportunity, formData: FormData) {
    const ok = await run(
      updateOpportunity({
        id: item.id,
        title: String(formData.get("title") ?? ""),
        value: String(formData.get("value") ?? ""),
        currency: formData.get("currency") === "HNL" ? "HNL" : "USD",
        propertyId: item.property_id ?? "",
        expectedCloseAt: String(formData.get("expectedCloseAt") ?? ""),
      })
    );
    if (ok) setEditingId(null);
  }

  const visible = includeClosed
    ? opportunities
    : opportunities.filter((item) => item.status === "abierta");

  return (
    <>
      {error && (
        <p role="alert" className="mb-4 bg-error-container text-on-error-container p-3 rounded">
          {error}
        </p>
      )}
      <p className="md:hidden mb-2 font-label-sm text-label-sm text-secondary flex items-center gap-1">
        <span aria-hidden="true" className="material-symbols-outlined text-sm">
          swipe_right
        </span>
        Desliza para ver todas las etapas
      </p>
      {isAdmin && (
        <p className="mb-2 font-label-sm text-label-sm text-secondary flex items-center gap-1">
          <span aria-hidden="true" className="material-symbols-outlined text-sm">
            drag_pan
          </span>
          Arrastra las tarjetas entre etapas para moverlas.
        </p>
      )}
      <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
        {stages.map((stage) => {
          const items = visible.filter((item) => item.stage_id === stage.id);
          const isOver = overStageId === stage.id && draggingId !== null;
          return (
            <section
              key={stage.id}
              onDragOver={(event) => {
                if (!draggingId) return;
                event.preventDefault();
                setOverStageId(stage.id);
              }}
              onDragLeave={() => setOverStageId((current) => (current === stage.id ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                setOverStageId(null);
                const dragged = visible.find((item) => item.id === draggingId);
                if (draggingId && dragged && dragged.stage_id !== stage.id) {
                  run(moveOpportunity(draggingId, stage.id));
                }
                setDraggingId(null);
              }}
              className={`w-72 flex-none border rounded-lg bg-surface-container-low transition-colors ${
                isOver ? "border-primary bg-primary-container/40" : "border-outline-variant"
              }`}
              aria-labelledby={`stage-${stage.id}`}
            >
              <header className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
                <h2
                  id={`stage-${stage.id}`}
                  className="font-label-md text-label-md text-on-surface"
                >
                  {stage.name}
                </h2>
                <span className="font-label-sm text-label-sm text-secondary">
                  {items.length}
                </span>
              </header>
              <div className="p-3 space-y-3">
                {items.length === 0 ? (
                  <p className="py-6 text-center font-label-sm text-label-sm text-secondary">
                    Sin oportunidades
                  </p>
                ) : (
                  items.map((item) => (
                    <article
                      key={item.id}
                      draggable={isAdmin && editingId !== item.id && item.status === "abierta"}
                      onDragStart={() => setDraggingId(item.id)}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setOverStageId(null);
                      }}
                      className={`bg-surface-container-lowest border border-outline-variant rounded p-3 ${
                        draggingId === item.id ? "opacity-50" : ""
                      } ${isAdmin && item.status === "abierta" && draggingId !== item.id ? "cursor-grab active:cursor-grabbing" : ""}`}
                    >
                      {editingId === item.id ? (
                        <form
                          action={(formData) => save(item, formData)}
                          className="space-y-2"
                        >
                          <input
                            name="title"
                            required
                            defaultValue={item.title}
                            className="w-full bg-surface rounded border border-outline-variant px-2 py-2 font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary"
                          />
                          <div className="flex">
                            <input
                              name="value"
                              type="number"
                              min="0"
                              defaultValue={item.value ?? ""}
                              className="min-w-0 flex-1 bg-surface rounded-l border border-outline-variant px-2 py-2 text-on-surface focus:border-primary"
                            />
                            <select
                              name="currency"
                              defaultValue={item.currency}
                              aria-label="Moneda"
                              className="bg-surface rounded-r border-y border-r border-outline-variant px-1 text-on-surface focus:border-primary"
                            >
                              <option value="USD">USD</option>
                              <option value="HNL">HNL</option>
                            </select>
                          </div>
                          <input
                            name="expectedCloseAt"
                            type="date"
                            defaultValue={item.expected_close_at ?? ""}
                            aria-label="Fecha estimada de cierre"
                            className="w-full bg-surface rounded border border-outline-variant px-2 py-2 text-on-surface focus:border-primary"
                          />
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={pending}
                              className="flex-1 rounded bg-primary text-on-primary px-2 py-1.5 font-label-sm text-label-sm"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-2 py-1.5 font-label-sm text-label-sm text-secondary"
                            >
                              Cancelar
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-label-md text-label-md text-on-surface">
                              {item.title}
                            </h3>
                            {item.status !== "abierta" && (
                              <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
                                {item.status === "ganada" ? "Ganada" : "Perdida"}
                              </span>
                            )}
                          </div>
                          {item.contact ? (
                            <Link
                              href={`/admin/crm/contactos/${item.contact.id}`}
                              className="mt-1 block font-label-sm text-label-sm text-primary hover:text-on-primary-container"
                            >
                              {item.contact.full_name}
                            </Link>
                          ) : (
                            <p className="mt-1 font-label-sm text-label-sm text-secondary">
                              Sin contacto
                            </p>
                          )}
                          {item.property && (
                            <Link
                              href={`/propiedades/${item.property.slug}`}
                              className="mt-1 block font-label-sm text-label-sm text-on-surface-variant hover:text-primary"
                            >
                              {item.property.title}
                            </Link>
                          )}
                          {item.value !== null && (
                            <p className="mt-3 font-label-md text-label-md text-primary">
                              {new Intl.NumberFormat(process.env.NEXT_PUBLIC_SITE_LOCALE || "es", {
                                style: "currency",
                                currency: item.currency,
                                maximumFractionDigits: 0,
                              }).format(Number(item.value))}
                            </p>
                          )}
                          {item.status === "abierta" ? (
                            <>
                              <label className="mt-3 block font-label-sm text-label-sm text-secondary">
                                Mover a
                                <select
                                  value={item.stage_id}
                                  disabled={pending}
                                  onChange={(event) =>
                                    run(moveOpportunity(item.id, event.target.value))
                                  }
                                  className="mt-1 w-full bg-surface rounded border border-outline-variant px-2 py-2.5 text-on-surface focus:border-primary"
                                >
                                  {stages.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <div className="mt-3 flex gap-2">
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() => setEditingId(item.id)}
                                  className="flex-1 rounded border border-outline-variant px-2 py-2 font-label-sm text-label-sm text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() =>
                                    run(setOpportunityStatus(item.id, "ganada"))
                                  }
                                  className="flex-1 rounded bg-primary-container px-2 py-2 font-label-sm text-label-sm text-on-primary-container hover:bg-primary hover:text-on-primary transition-colors disabled:opacity-50"
                                >
                                  Ganada
                                </button>
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() =>
                                    run(setOpportunityStatus(item.id, "perdida"))
                                  }
                                  className="flex-1 rounded bg-error-container px-2 py-2 font-label-sm text-label-sm text-on-error-container hover:bg-error hover:text-on-error transition-colors disabled:opacity-50"
                                >
                                  Perdida
                                </button>
                              </div>
                              {isAdmin && (
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() => {
                                    if (confirm(`¿Eliminar la oportunidad "${item.title}"?`)) {
                                      run(deleteOpportunity(item.id));
                                    }
                                  }}
                                  className="mt-2 w-full rounded px-2 py-1.5 font-label-sm text-label-sm text-secondary hover:text-error hover:bg-surface-container-high transition-colors disabled:opacity-50"
                                >
                                  Eliminar
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() =>
                                run(setOpportunityStatus(item.id, "abierta"))
                              }
                              className="mt-3 w-full rounded border border-outline-variant px-2 py-2 font-label-sm text-label-sm text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
                            >
                              Reabrir
                            </button>
                          )}
                        </>
                      )}
                    </article>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
