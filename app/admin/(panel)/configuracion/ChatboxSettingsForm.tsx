"use client";

import { useState, useTransition } from "react";
import {
  regenerateChatboxKey,
  saveChatboxSettings,
} from "@/lib/chatbox-actions";
import type { ChatboxSettings } from "@/lib/chatbox-types";

export default function ChatboxSettingsForm({
  initial,
  installBaseUrl,
  canEdit,
}: {
  initial: ChatboxSettings;
  installBaseUrl: string;
  canEdit: boolean;
}) {
  const [values, setValues] = useState(initial);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const snippet = values.widget_key
    ? `<script src="${installBaseUrl}/widget.js" data-key="${values.widget_key}" defer></script>`
    : "La clave aparecerá después de aplicar la migración del chatbox.";

  function set<K extends keyof ChatboxSettings>(key: K, value: ChatboxSettings[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function save() {
    setMessage("");
    startTransition(async () => {
      const result = await saveChatboxSettings({
        enabled: values.enabled,
        welcome: values.welcome,
        color: values.color,
        statusMessage: values.status_message,
        offlineMessage: values.offline_message,
        position: values.position,
        launcher: values.launcher,
        assistantEnabled: values.assistant_enabled,
        assistantName: values.assistant_name,
        assistantInstructions: values.assistant_instructions,
        handoffMessage: values.handoff_message,
        knowledge: values.knowledge,
      });
      setMessage(result.ok ? "Configuración del chatbox guardada." : result.error);
    });
  }

  function regenerate() {
    if (!window.confirm("La clave actual dejará de funcionar en instalaciones externas. ¿Continuar?")) return;
    startTransition(async () => {
      const result = await regenerateChatboxKey();
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      window.location.reload();
    });
  }

  return (
    <section className="mt-8 rounded-lg border border-outline-variant bg-surface-container-low p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Chatbox del sitio</h2>
          <p className="mt-1 max-w-3xl font-body-md text-body-md text-secondary">
            El chat crea solicitudes web en el CRM. La IA responde cuando está activa y el administrador puede tomar la conversación en cualquier momento.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-secondary">
          <input type="checkbox" checked={values.enabled} onChange={(event) => set("enabled", event.target.checked)} disabled={!canEdit || pending} className="h-4 w-4 accent-[var(--color-primary)]" />
          Chat visible en el sitio
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Mensaje de bienvenida"><input value={values.welcome} onChange={(event) => set("welcome", event.target.value)} disabled={!canEdit || pending} /></Field>
        <Field label="Mensaje de disponibilidad"><input value={values.status_message} onChange={(event) => set("status_message", event.target.value)} disabled={!canEdit || pending} /></Field>
        <Field label="Mensaje fuera de horario"><input value={values.offline_message} onChange={(event) => set("offline_message", event.target.value)} disabled={!canEdit || pending} /></Field>
        <Field label="Color del chat"><div className="flex gap-2"><input type="color" value={values.color} onChange={(event) => set("color", event.target.value)} disabled={!canEdit || pending} className="h-11 w-14 rounded border border-outline-variant bg-surface p-1" /><input value={values.color} onChange={(event) => set("color", event.target.value)} disabled={!canEdit || pending} /></div></Field>
        <Field label="Posición"><select value={values.position} onChange={(event) => set("position", event.target.value as "left" | "right")} disabled={!canEdit || pending}><option value="right">Derecha</option><option value="left">Izquierda</option></select></Field>
        <Field label="Icono del botón"><input value={values.launcher} maxLength={4} onChange={(event) => set("launcher", event.target.value)} disabled={!canEdit || pending} /></Field>
      </div>

      <div className="mt-6 border-t border-outline-variant pt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-headline-sm text-on-surface">Asistente IA</h3><p className="text-sm text-secondary">Si está desactivado, todos los mensajes quedarán para atención humana.</p></div>
          <label className="inline-flex items-center gap-2 text-sm text-secondary"><input type="checkbox" checked={values.assistant_enabled} onChange={(event) => set("assistant_enabled", event.target.checked)} disabled={!canEdit || pending} className="h-4 w-4 accent-[var(--color-primary)]" /> Respuestas automáticas</label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre del asistente"><input value={values.assistant_name} onChange={(event) => set("assistant_name", event.target.value)} disabled={!canEdit || pending} /></Field>
          <Field label="Mensaje al transferir a una persona"><input value={values.handoff_message} onChange={(event) => set("handoff_message", event.target.value)} disabled={!canEdit || pending} /></Field>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Instrucciones de tono"><textarea value={values.assistant_instructions} onChange={(event) => set("assistant_instructions", event.target.value)} disabled={!canEdit || pending} rows={4} /></Field>
          <Field label="Información confirmada para responder"><textarea value={values.knowledge} onChange={(event) => set("knowledge", event.target.value)} disabled={!canEdit || pending} rows={4} placeholder="Horarios, servicios, ubicación, políticas y preguntas frecuentes." /></Field>
        </div>
      </div>

      <div className="mt-6 border-t border-outline-variant pt-6">
        <h3 className="font-headline-sm text-on-surface">Instalación externa</h3>
        <p className="mt-1 text-sm text-secondary">Use este código solo si el sitio público está en otro dominio. No contiene secretos.</p>
        <pre className="mt-3 overflow-x-auto rounded bg-surface p-3 text-xs text-on-surface">{snippet}</pre>
        {canEdit && values.widget_key ? <button type="button" onClick={() => navigator.clipboard?.writeText(snippet)} className="mt-3 rounded border border-outline-variant px-3 py-2 text-sm text-secondary hover:bg-surface-container-high">Copiar código</button> : null}
      </div>

      {message ? <p role="status" className="mt-4 text-sm text-secondary">{message}</p> : null}
      {canEdit ? <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={save} disabled={pending} className="rounded bg-primary px-4 py-2 font-semibold text-on-primary disabled:opacity-60">{pending ? "Guardando…" : "Guardar chatbox"}</button><button type="button" onClick={regenerate} disabled={pending} className="rounded border border-error px-4 py-2 text-error disabled:opacity-60">Regenerar clave</button></div> : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm text-secondary">{label}<div className="mt-1 [&_input]:w-full [&_input]:rounded [&_input]:border [&_input]:border-outline-variant [&_input]:bg-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-on-surface [&_textarea]:w-full [&_textarea]:rounded [&_textarea]:border [&_textarea]:border-outline-variant [&_textarea]:bg-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:text-on-surface [&_select]:w-full [&_select]:rounded [&_select]:border [&_select]:border-outline-variant [&_select]:bg-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-on-surface">{children}</div></label>;
}
