"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  recordContactConsent,
  revokeContactConsent,
} from "@/lib/crm-actions";

export default function ContactConsentActions({
  contactId,
}: {
  contactId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function run(
    action: Promise<{ ok: boolean; error?: string }>
  ) {
    setError(null);
    const result = await action;
    if (!result.ok) {
      setError(result.error ?? "No se pudo guardar.");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(recordContactConsent(contactId, "utility"))}
        className="px-3 py-1.5 rounded border border-outline-variant font-label-sm text-label-sm text-on-surface hover:bg-surface-container-low disabled:opacity-50"
      >
        Registrar utilidad
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(recordContactConsent(contactId, "marketing"))}
        className="px-3 py-1.5 rounded border border-outline-variant font-label-sm text-label-sm text-on-surface hover:bg-surface-container-low disabled:opacity-50"
      >
        Registrar marketing
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(revokeContactConsent(contactId, "utility"))}
        className="px-3 py-1.5 rounded font-label-sm text-label-sm text-secondary hover:text-error disabled:opacity-50"
      >
        Revocar utilidad
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(revokeContactConsent(contactId, "marketing"))}
        className="px-3 py-1.5 rounded font-label-sm text-label-sm text-secondary hover:text-error disabled:opacity-50"
      >
        Revocar marketing
      </button>
      {error && (
        <p role="alert" className="basis-full text-on-error-container font-label-sm text-label-sm">
          {error}
        </p>
      )}
    </div>
  );
}
