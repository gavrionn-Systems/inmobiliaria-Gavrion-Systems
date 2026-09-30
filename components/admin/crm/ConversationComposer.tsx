"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendCrmMessage } from "@/lib/crm-actions";
import {
  fillTemplatePreview,
  templateVariableSlots,
  type TemplateComponent,
} from "@/lib/template-placeholders";

type Template = {
  name: string;
  language: string;
  category: string;
  body_preview: string | null;
  components?: TemplateComponent[] | null;
};

export default function ConversationComposer({
  conversationId,
  channel,
  windowOpen,
  templates,
}: {
  conversationId: string;
  channel: "whatsapp" | "web" | "instagram" | "messenger";
  windowOpen: boolean;
  templates: Template[];
}) {
  const isWhatsapp = channel === "whatsapp";
  const receiveOnly = channel === "instagram" || channel === "messenger";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [headerParam, setHeaderParam] = useState("");
  const [bodyParams, setBodyParams] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selectedTemplate = templates.find(
    (template) => template.name === templateName
  );
  const slots = useMemo(
    () => templateVariableSlots(selectedTemplate?.components ?? []),
    [selectedTemplate]
  );
  const needsTemplate = isWhatsapp && !windowOpen;
  const preview = selectedTemplate
    ? fillTemplatePreview(
        selectedTemplate.body_preview,
        bodyParams
      )
    : "";

  function selectTemplate(name: string) {
    setTemplateName(name);
    const template = templates.find((item) => item.name === name);
    const nextSlots = templateVariableSlots(template?.components ?? []);
    setHeaderParam("");
    setBodyParams(nextSlots.body.map(() => ""));
    setBody(template?.body_preview ?? template?.name ?? "");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (needsTemplate) {
      if (!selectedTemplate) {
        setError("Seleccione una plantilla aprobada para continuar.");
        return;
      }
      if (slots.header && !headerParam.trim()) {
        setError("Complete el parámetro del encabezado.");
        return;
      }
      if (bodyParams.some((value) => !value.trim())) {
        setError("Complete todas las variables de la plantilla.");
        return;
      }
    }
    const filled = needsTemplate
      ? fillTemplatePreview(selectedTemplate?.body_preview, bodyParams) ||
        selectedTemplate?.name ||
        body
      : body;
    const result = await sendCrmMessage({
      conversationId,
      body: filled,
      templateName: needsTemplate ? templateName : null,
      templateLanguage: needsTemplate ? selectedTemplate?.language : null,
      templateHeader: needsTemplate && slots.header ? headerParam : null,
      templateBodyParams: needsTemplate ? bodyParams : [],
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBody("");
    setTemplateName("");
    setHeaderParam("");
    setBodyParams([]);
    startTransition(() => router.refresh());
  }

  if (receiveOnly) {
    return (
      <div className="border-t border-outline-variant bg-surface-container-lowest p-4">
        <p className="font-label-sm text-label-sm text-on-surface-variant">
          Canal de solo recepción: la respuesta por{" "}
          {channel === "instagram" ? "Instagram" : "Messenger"} todavía no está
          disponible. Contacte a la persona por WhatsApp o teléfono; su ficha
          queda registrada en el CRM.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="border-t border-outline-variant bg-surface-container-lowest p-4"
    >
      {!isWhatsapp && (
        <p className="mb-3 font-label-sm text-label-sm text-on-surface-variant">
          Conversación web: la respuesta queda registrada en el CRM. Contacte a
          la persona por email o teléfono.
        </p>
      )}
      {needsTemplate && (
        <div className="mb-3 space-y-3">
          <p className="font-label-sm text-label-sm text-on-surface-variant">
            La ventana de 24 horas está cerrada. Use una plantilla aprobada.
          </p>
          <label className="sr-only" htmlFor="crm-template">
            Plantilla de WhatsApp
          </label>
          <select
            id="crm-template"
            required
            value={templateName}
            onChange={(event) => selectTemplate(event.target.value)}
            className="w-full bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary outline-none"
          >
            <option value="">Seleccione una plantilla</option>
            {templates.map((template) => (
              <option key={`${template.name}-${template.language}`} value={template.name}>
                {template.name} · {template.category}
              </option>
            ))}
          </select>
          {slots.header && (
            <label className="flex flex-col gap-1 font-label-sm text-label-sm text-secondary">
              Encabezado
              <input
                value={headerParam}
                onChange={(event) => setHeaderParam(event.target.value)}
                required
                maxLength={200}
                className="bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary outline-none"
              />
            </label>
          )}
          {slots.body.map((slot, index) => (
            <label
              key={slot}
              className="flex flex-col gap-1 font-label-sm text-label-sm text-secondary"
            >
              Variable {slot}
              <input
                value={bodyParams[index] ?? ""}
                onChange={(event) => {
                  const next = [...bodyParams];
                  next[index] = event.target.value;
                  setBodyParams(next);
                }}
                required
                maxLength={1024}
                className="bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary outline-none"
              />
            </label>
          ))}
          {preview && (
            <p className="rounded bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface-variant whitespace-pre-wrap">
              {preview}
            </p>
          )}
        </div>
      )}

      {(!needsTemplate || !selectedTemplate) && (
        <>
          <label className="sr-only" htmlFor="crm-message">
            Mensaje
          </label>
          <textarea
            id="crm-message"
            required={!needsTemplate}
            maxLength={4096}
            rows={3}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Escriba una respuesta…"
            className="w-full resize-y bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-primary outline-none"
          />
        </>
      )}
      {error && (
        <p role="alert" className="mt-2 text-on-error-container font-label-sm text-label-sm">
          {error}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="font-label-sm text-label-sm text-secondary">
          {(needsTemplate ? preview : body).length}/4096
        </span>
        <button
          type="submit"
          disabled={
            pending || (needsTemplate && templates.length === 0)
          }
          className="bg-primary text-on-primary px-5 py-2.5 rounded font-label-md text-label-md hover:bg-primary-fixed-dim hover:text-on-primary-fixed disabled:opacity-50 transition-colors"
        >
          {pending
            ? "Guardando…"
            : isWhatsapp
              ? "Enviar por WhatsApp"
              : "Registrar respuesta"}
        </button>
      </div>
    </form>
  );
}
