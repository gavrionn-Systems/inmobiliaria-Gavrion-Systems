"use client";

import { useTransition, useState } from "react";
import { createInquiry } from "@/lib/actions";

export default function ContactForm({
  propertyId = null,
  propertySlug = null,
}: {
  propertyId?: string | null;
  propertySlug?: string | null;
}) {
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState(() => {
    if (!propertySlug) return "";
    const prefill = `Consulta sobre ${propertySlug}`;
    return prefill.slice(0, 120);
  });

  if (sent) {
    return (
      <div className="bg-primary-container/40 border border-primary-container rounded-lg p-8 text-center">
        <span aria-hidden="true" className="material-symbols-outlined text-4xl text-primary mb-2">
          check_circle
        </span>
        <h2 className="font-headline-md text-headline-md text-on-surface mb-2">
          ¡Mensaje enviado!
        </h2>
        <p className="font-body-md text-body-md text-secondary">
          Gracias por contactarnos. Un agente le responderá muy pronto.
        </p>
      </div>
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createInquiry({
        full_name: String(form.get("nombre") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("telefono") ?? "") || null,
        subject: String(form.get("asunto") ?? subject),
        message: String(form.get("mensaje") ?? ""),
        property_id: propertyId,
        empresa: String(form.get("empresa") ?? ""),
      });
      if (!result.ok) {
        setError(result.error ?? "No se pudo enviar el mensaje.");
        return;
      }
      setSent(true);
    });
  }

  return (
    <form
      className="bg-surface-container-low rounded-lg p-6 md:p-8 flex flex-col gap-4"
      onSubmit={onSubmit}
    >
      {error && (
        <p
          role="alert"
          className="bg-error-container text-on-error-container font-body-md text-body-md px-4 py-3 rounded"
        >
          {error}
        </p>
      )}

      {propertySlug && (
        <p className="bg-primary-container/40 border border-primary-container rounded px-4 py-2.5 font-body-md text-body-md text-on-primary-container">
          Consultando por: {propertySlug}
        </p>
      )}

      {/* Honeypot anti-spam: oculto para usuarios, los bots lo rellenan */}
      <input
        type="text"
        name="empresa"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col">
          <span className="font-label-sm text-label-sm text-secondary mb-1">
            Nombre completo
          </span>
          <input
            type="text"
            name="nombre"
            required
            placeholder="Su nombre"
            className="bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary"
          />
        </label>
        <label className="flex flex-col">
          <span className="font-label-sm text-label-sm text-secondary mb-1">
            Email
          </span>
          <input
            type="email"
            name="email"
            required
            placeholder="su@email.com"
            className="bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary"
          />
        </label>
      </div>
      <label className="flex flex-col">
        <span className="font-label-sm text-label-sm text-secondary mb-1">
          Teléfono
        </span>
        <input
          type="tel"
          name="telefono"
          placeholder="+504 0000-0000"
          className="bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary"
        />
      </label>
      <label className="flex flex-col">
        <span className="font-label-sm text-label-sm text-secondary mb-1">
          Asunto
        </span>
        <input
          type="text"
          name="asunto"
          required
          maxLength={120}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Asunto de su consulta"
          className="bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary"
        />
      </label>
      <label className="flex flex-col">
        <span className="font-label-sm text-label-sm text-secondary mb-1">
          Mensaje
        </span>
        <textarea
          name="mensaje"
          rows={5}
          required
          placeholder="Cuéntenos qué está buscando…"
          className="bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary resize-y"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-on-primary font-label-md text-label-md px-8 py-3 rounded hover:bg-primary-fixed-dim hover:text-on-primary-fixed transition-colors self-start disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Enviar Mensaje"}
      </button>
    </form>
  );
}