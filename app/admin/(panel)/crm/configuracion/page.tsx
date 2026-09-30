import { redirect } from "next/navigation";
import CrmAdminActions from "@/components/admin/crm/CrmAdminActions";
import { getSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/demo-auth";
import { getCrmConfiguration } from "@/lib/crm-queries";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Configuración CRM · Admin" };

function IntegrationState({
  label,
  ready,
  description,
}: {
  label: string;
  ready: boolean;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div>
        <h2 className="font-label-md text-label-md text-on-surface">{label}</h2>
        <p className="mt-1 font-body-md text-body-md text-secondary">
          {description}
        </p>
      </div>
      <span
        className={`rounded-full px-2 py-1 font-label-sm text-label-sm ${
          ready
            ? "bg-primary-container text-on-primary-container"
            : "bg-error-container text-on-error-container"
        }`}
      >
        {ready ? "Configurado" : "Pendiente"}
      </span>
    </div>
  );
}

export default async function CrmConfigurationPage() {
  const session = await getSession();
  if (!session || !isAdminRole(session.user.role)) redirect("/admin?error=forbidden");
  const configuration = await getCrmConfiguration();
  if (!configuration) redirect("/admin/crm/inbox");

  return (
    <>
      <header className="mb-6">
        <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-1">
          Configuración del CRM
        </h1>
        <p className="font-body-md text-body-md text-secondary">
          Estado operativo de las integraciones directas y las plantillas aprobadas.
        </p>
      </header>

      <section className="border border-outline-variant rounded-lg bg-surface-container-lowest px-5 divide-y divide-outline-variant">
        <IntegrationState
          label="Webhook de Meta"
          ready={configuration.integration.metaWebhook}
          description="Valida firmas y recibe mensajes y estados de WhatsApp."
        />
        <IntegrationState
          label="Despachador programado"
          ready={configuration.integration.scheduler}
          description="Procesa la cola con reintentos sin bloquear el panel."
        />
        <IntegrationState
          label="Sync de plantillas"
          ready={configuration.integration.templateSync}
          description="Lee el catálogo de Meta con META_WHATSAPP_TOKEN y META_WABA_ID."
        />
      </section>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Cola de integración
          </h2>
          <p className="font-label-sm text-label-sm text-secondary">
            Pendientes: {configuration.eventCounts.pending ?? 0} · Fallidos:{" "}
            {configuration.eventCounts.failed ?? 0}
          </p>
        </div>
        {(configuration.eventCounts.failed ?? 0) > 0 && (
          <p className="mb-3 bg-error-container text-on-error-container rounded p-3 font-body-md text-body-md">
            Hay eventos pendientes de revisión en el sistema.
          </p>
        )}
        <CrmAdminActions />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-headline-md text-headline-md text-on-surface">
          Plantillas de WhatsApp
        </h2>
        {configuration.templates.length === 0 ? (
          <p className="border border-dashed border-outline-variant rounded-lg p-6 text-secondary">
            Aún no se han sincronizado plantillas aprobadas desde Meta.
          </p>
        ) : (
          <div className="overflow-x-auto border border-outline-variant rounded-lg bg-surface-container-lowest">
            <table className="w-full min-w-[680px] text-left">
              <thead className="bg-surface-container-low text-secondary">
                <tr>
                  <th className="px-4 py-3 font-label-sm">Nombre</th>
                  <th className="px-4 py-3 font-label-sm">Categoría</th>
                  <th className="px-4 py-3 font-label-sm">Estado</th>
                  <th className="px-4 py-3 font-label-sm">Actualizada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {configuration.templates.map((template) => (
                  <tr key={template.id}>
                    <td className="px-4 py-3">
                      <p className="font-label-md text-label-md text-on-surface">
                        {template.name}
                      </p>
                      <p className="font-label-sm text-label-sm text-secondary">
                        {template.language}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {template.category}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {template.status}
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {formatDate(template.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
