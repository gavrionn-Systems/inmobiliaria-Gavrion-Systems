"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createStage,
  deleteStage,
  moveStage,
  renameStage,
} from "@/lib/crm-actions";

type Stage = { id: string; name: string; position: number; is_closed: boolean };

export default function StageManager({ stages }: { stages: Stage[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  function run(action: Promise<{ ok: boolean; error?: string }>, done?: () => void) {
    setError(null);
    void action.then((result) => {
      if (!result.ok) {
        setError(result.error ?? "No se pudo guardar.");
        return;
      }
      done?.();
      startTransition(() => router.refresh());
    });
  }

  return (
    <section
      aria-labelledby="stage-manager-title"
      className="mt-8 border border-outline-variant rounded-lg bg-surface-container-low p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="stage-manager-title" className="font-label-lg text-label-lg text-on-surface">
          Etapas del pipeline
        </h2>
        <button
          type="button"
          disabled={pending}
          onClick={() => setAdding((value) => !value)}
          className="rounded border border-outline-variant px-3 py-1.5 font-label-sm text-label-sm text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
        >
          {adding ? "Cancelar" : "Nueva etapa"}
        </button>
      </div>
      <p className="mt-1 font-label-sm text-label-sm text-secondary">
        Crea, renombra u ordena las etapas del embudo. Se aplican a todo el equipo.
      </p>

      {error && (
        <p role="alert" className="mt-3 bg-error-container text-on-error-container p-2 rounded">
          {error}
        </p>
      )}

      {adding && (
        <form
          action={(formData) => {
            run(createStage(String(formData.get("name") ?? "")), () => setAdding(false));
          }}
          className="mt-3 flex gap-2"
        >
          <input
            name="name"
            required
            minLength={2}
            maxLength={40}
            placeholder="Nombre de la etapa (p. ej. Financiamiento)"
            autoFocus
            className="flex-1 bg-surface rounded border border-outline-variant px-3 py-2 font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary outline-none"
          />
          <button
            type="submit"
            disabled={pending}
            className="bg-primary text-on-primary rounded px-4 py-2 font-label-sm text-label-sm disabled:opacity-50"
          >
            Crear
          </button>
        </form>
      )}

      <ul className="mt-4 divide-y divide-outline-variant">
        {stages.map((stage, index) => (
          <li key={stage.id} className="py-2 flex items-center gap-2">
            <div className="flex flex-col">
              <button
                type="button"
                aria-label={`Subir ${stage.name}`}
                disabled={pending || index === 0}
                onClick={() => run(moveStage(stage.id, "up"))}
                className="text-secondary hover:text-on-surface disabled:opacity-30 leading-none"
              >
                ▲
              </button>
              <button
                type="button"
                aria-label={`Bajar ${stage.name}`}
                disabled={pending || index === stages.length - 1}
                onClick={() => run(moveStage(stage.id, "down"))}
                className="text-secondary hover:text-on-surface disabled:opacity-30 leading-none"
              >
                ▼
              </button>
            </div>
            {editingId === stage.id ? (
              <form
                action={(formData) => {
                  run(renameStage(stage.id, String(formData.get("name") ?? "")), () =>
                    setEditingId(null)
                  );
                }}
                className="flex flex-1 gap-2"
              >
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={40}
                  defaultValue={stage.name}
                  autoFocus
                  className="flex-1 bg-surface rounded border border-outline-variant px-2 py-1.5 font-body-md text-body-md text-on-surface focus:border-primary outline-none"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded bg-primary text-on-primary px-3 py-1.5 font-label-sm text-label-sm disabled:opacity-50"
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
              </form>
            ) : (
              <>
                <span className="flex-1 font-body-md text-body-md text-on-surface">
                  {stage.name}
                  {stage.is_closed && (
                    <span className="ml-2 rounded-full bg-surface-container-high px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant align-middle">
                      cierre
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setEditingId(stage.id)}
                  className="px-2 py-1 font-label-sm text-label-sm text-primary hover:text-on-primary-container disabled:opacity-50"
                >
                  Renombrar
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (confirm(`¿Eliminar la etapa "${stage.name}"?`)) {
                      run(deleteStage(stage.id));
                    }
                  }}
                  className="px-2 py-1 font-label-sm text-label-sm text-error hover:text-on-error-container disabled:opacity-50"
                >
                  Eliminar
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
