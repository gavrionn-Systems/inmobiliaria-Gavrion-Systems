"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncTemplatesNow } from "@/lib/crm-actions";

type ActionKey = "sync";

export default function CrmAdminActions() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [running, setRunning] = useState<ActionKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(
    key: ActionKey,
    action: () => Promise<{ ok: boolean; error?: string }>,
    successMessage: string
  ) {
    setRunning(key);
    setError(null);
    setMessage(null);
    const result = await action();
    setRunning(null);
    if (!result.ok) {
      setError(result.error ?? "No se pudo completar la operación.");
      return;
    }
    setMessage(successMessage);
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={running !== null}
          onClick={() =>
            run("sync", syncTemplatesNow, "Plantillas sincronizadas desde Meta.")
          }
          className="rounded border border-outline-variant bg-surface px-4 py-2 font-label-md text-label-md text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
        >
          {running === "sync" ? "Sincronizando…" : "Sincronizar plantillas"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 bg-error-container text-on-error-container rounded p-3 font-body-md text-body-md">
          {error}
        </p>
      )}
      {message && !error && (
        <p role="status" className="mt-3 font-label-sm text-label-sm text-primary">
          {message}
        </p>
      )}
    </div>
  );
}
