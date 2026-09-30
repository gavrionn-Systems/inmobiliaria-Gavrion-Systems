import Link from "next/link";
import PipelineBoard from "@/components/admin/crm/PipelineBoard";
import OpportunityCreateForm from "@/components/admin/crm/OpportunityCreateForm";
import StageManager from "@/components/admin/crm/StageManager";
import { getCrmCreationOptions, getCrmPipeline } from "@/lib/crm-queries";
import { authorize } from "@/lib/auth";

export const metadata = { title: "Pipeline CRM �� Admin" };

export default async function CrmPipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const includeClosed = params.cerradas === "1";
  const [{ stages, opportunities }, options, adminSession] = await Promise.all([
    getCrmPipeline(includeClosed),
    getCrmCreationOptions(),
    authorize(["admin"]),
  ]);
  const isAdmin = Boolean(adminSession);
  const defaultStageId =
    stages.find((stage) => !stage.is_closed)?.id ?? stages[0]?.id ?? "";
  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-1">
            Pipeline
          </h1>
          <p className="font-body-md text-body-md text-secondary">
            Avance comercial de las oportunidades del equipo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={includeClosed ? "/admin/crm/pipeline" : "/admin/crm/pipeline?cerradas=1"}
            className="font-label-md text-label-md text-primary hover:text-on-primary-container"
          >
            {includeClosed ? "Ocultar cerradas" : "Mostrar cerradas"}
          </Link>
          <OpportunityCreateForm
            contacts={options.contacts}
            stages={options.stages}
            properties={options.properties}
            defaultStageId={defaultStageId}
          />
        </div>
      </header>
      <PipelineBoard
        stages={stages}
        opportunities={opportunities}
        includeClosed={includeClosed}
        isAdmin={isAdmin}
      />
      {isAdmin && <StageManager stages={stages} />}
    </>
  );
}
