"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTransition, useState } from "react";
import { setInquiryStatus } from "@/lib/actions";
import { formatDate } from "@/lib/format";
import { isBankAdvisoryRequest } from "@/lib/bank-advisory";

type InquiryRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string | null;
  message: string | null;
  status: string;
  created_at: string;
  crm_conversation_id: string | null;
  properties: { title: string; slug: string } | null;
};

const STATUS_OPTIONS = [
  { value: "nueva", label: "Nueva" },
  { value: "en_proceso", label: "En proceso" },
  { value: "cerrada", label: "Cerrada" },
];

export default function InquiriesList({ rows }: { rows: InquiryRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div className="bg-surface-container-low rounded-lg border border-dashed border-outline-variant p-10 text-center">
        <span className="material-symbols-outlined text-4xl text-secondary mb-3">
          mark_email_read
        </span>
        <h2 className="font-headline-md text-headline-md text-on-surface mb-2">
          Sin solicitudes todavía
        </h2>
        <p className="font-body-md text-body-md text-secondary max-w-md mx-auto">
          Cuando alguien contacte desde el formulario de la página, su mensaje
          aparecerá aquí.
        </p>
      </div>
    );
  }

  async function changeStatus(id: string, status: string) {
    setError(null);
    const result = await setInquiryStatus(id, status);
    if (!result.ok) {
      setError(result.error ?? "No se pudo actualizar el estado.");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div>
      {error && (
        <p
          role="alert"
          className="mb-4 bg-error-container text-on-error-container font-body-md text-body-md px-4 py-3 rounded"
        >
          {error}
        </p>
      )}

      <div className="bg-surface-container-low rounded-lg border border-outline-variant divide-y divide-outline-variant/60">
        {rows.map((inq) => {
          const isBankAdvisory = isBankAdvisoryRequest(inq.subject, inq.message);
          return (
          <article key={inq.id} className="px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-label-lg text-label-lg text-on-surface">
                    {inq.name}
                  </h2>
                  {inq.status === "nueva" && (
                    <span className="bg-primary-container text-on-primary-container font-label-sm text-label-sm px-2 py-0.5 rounded">
                      Nueva
                    </span>
                  )}
                  {isBankAdvisory && (
                    <span
                      title="Solicitud de asesoría bancaria: se gestiona manualmente."
                      className="bg-secondary-container text-on-secondary-container font-label-sm text-label-sm px-2 py-0.5 rounded"
                    >
                      Asesoría bancaria · gestión manual
                    </span>
                  )}
                </div>
                <p className="font-label-sm text-label-sm text-secondary mt-0.5">
                  {formatDate(inq.created_at)}
                </p>
              </div>
              <label className="flex items-center gap-2 font-label-sm text-label-sm text-secondary">
                Estado
                <select
                  value={inq.status}
                  disabled={pending}
                  onChange={(e) => changeStatus(inq.id, e.target.value)}
                  className="bg-surface rounded border border-outline-variant px-2 py-1.5 font-label-sm text-label-sm text-on-surface outline-none focus:border-primary"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 font-body-sm text-body-sm">
              {inq.properties && (
                <div>
                  <dt className="text-secondary">Propiedad</dt>
                  <dd className="text-on-surface truncate">
                    {inq.properties.title}
                  </dd>
                </div>
              )}
              {inq.phone && (
                <div>
                  <dt className="text-secondary">Teléfono</dt>
                  <dd>
                    <a
                      href={`tel:${inq.phone}`}
                      className="text-primary hover:text-primary-fixed-dim"
                    >
                      {inq.phone}
                    </a>
                  </dd>
                </div>
              )}
              {inq.email && (
                <div>
                  <dt className="text-secondary">Email</dt>
                  <dd className="truncate">
                    <a
                      href={`mailto:${inq.email}`}
                      className="text-primary hover:text-primary-fixed-dim"
                    >
                      {inq.email}
                    </a>
                  </dd>
                </div>
              )}
            </dl>

            {inq.message && (
              <p className="mt-3 font-body-md text-body-md text-on-surface bg-surface rounded p-3 border border-outline-variant/60 whitespace-pre-line">
                {inq.message}
              </p>
            )}

            {isBankAdvisory && (
              <p className="mt-3 font-label-sm text-label-sm text-secondary">
                Solicitud de asesoría bancaria: por su complejidad se atiende
                de forma manual, no automatizada.
                {inq.crm_conversation_id ? (
                  <>
                    {" "}
                    <Link
                      href={`/admin/crm/inbox/${inq.crm_conversation_id}`}
                      className="text-primary hover:text-primary-fixed-dim"
                    >
                      Ver en el CRM →
                    </Link>
                  </>
                ) : null}
              </p>
            )}
          </article>
          );
        })}
      </div>
    </div>
  );
}