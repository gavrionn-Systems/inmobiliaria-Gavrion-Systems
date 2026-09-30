"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  assignConversation,
  optOutContact,
  setConversationBotMode,
  setConversationStatus,
} from "@/lib/crm-actions";

type Profile = { id: string; full_name: string; role: string };

export default function ConversationControls({
  conversationId,
  contactId,
  status,
  botMode,
  assignedTo,
  profiles,
  canAssign,
  canClaim,
  canTakeover,
  currentUserId,
}: {
  conversationId: string;
  contactId: string;
  status: string;
  botMode: string;
  assignedTo: string | null;
  profiles: Profile[];
  canAssign: boolean;
  canClaim: boolean;
  canTakeover: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function run(action: Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    const result = await action;
    if (!result.ok) {
      setError(result.error ?? "No se pudo guardar el cambio.");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      {botMode === "manual" && (
        <span className="inline-flex items-center gap-1 self-center rounded bg-secondary-container px-2 py-1 font-label-sm text-label-sm text-on-secondary-container">
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            pause_circle
          </span>
          IA desactivada · gestión manual
        </span>
      )}

      {canTakeover && botMode === "ia" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(setConversationBotMode(conversationId, "manual"))}
          title="Desactiva la IA de esta conversación y se la asigna a usted."
          className="px-3 py-2 font-label-md text-label-md bg-primary text-on-primary rounded disabled:opacity-50"
        >
          Tomar conversación
        </button>
      )}
      {canTakeover && botMode === "manual" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(setConversationBotMode(conversationId, "ia"))}
          className="px-3 py-2 font-label-md text-label-md bg-surface border border-outline-variant text-on-surface hover:border-primary hover:text-primary rounded transition-colors disabled:opacity-50"
        >
          Reactivar IA
        </button>
      )}

      <label className="flex flex-col gap-1 font-label-sm text-label-sm text-secondary">
        Estado
        <select
          defaultValue={status}
          disabled={pending}
          onChange={(event) =>
            run(setConversationStatus(conversationId, event.target.value))
          }
          className="bg-surface rounded border border-outline-variant px-3 py-2 font-label-md text-label-md text-on-surface focus:border-primary outline-none"
        >
          <option value="abierta">Abierta</option>
          <option value="pendiente">Pendiente</option>
          <option value="cerrada">Cerrada</option>
        </select>
      </label>

      {canAssign && (
        <label className="flex flex-col gap-1 font-label-sm text-label-sm text-secondary">
          Responsable
          <select
            defaultValue={assignedTo ?? ""}
            disabled={pending}
            onChange={(event) =>
              run(assignConversation(conversationId, event.target.value))
            }
            className="bg-surface rounded border border-outline-variant px-3 py-2 font-label-md text-label-md text-on-surface focus:border-primary outline-none"
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

      {canClaim && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(assignConversation(conversationId, currentUserId))}
          className="px-3 py-2 font-label-md text-label-md bg-primary text-on-primary rounded disabled:opacity-50"
        >
          Tomar conversación
        </button>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (
            window.confirm(
              "¿Registrar que este contacto no desea recibir más mensajes?"
            )
          ) {
            run(optOutContact(contactId));
          }
        }}
        className="px-3 py-2 font-label-md text-label-md text-error hover:bg-error-container rounded transition-colors disabled:opacity-50"
      >
        Registrar baja
      </button>
      {error && (
        <p role="alert" className="basis-full text-on-error-container text-label-sm">
          {error}
        </p>
      )}
    </div>
  );
}
