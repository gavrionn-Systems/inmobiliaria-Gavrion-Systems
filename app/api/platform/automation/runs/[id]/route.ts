import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const statuses = new Set(["queued", "running", "succeeded", "failed"]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const expected = process.env.PLATFORM_RUNNER_TOKEN;
  const authorization = request.headers.get("authorization");
  if (!expected || authorization !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const status = typeof body?.status === "string" ? body.status : "";
  if (!statuses.has(status)) return NextResponse.json({ error: "Estado no válido." }, { status: 400 });

  const patch: Record<string, unknown> = {
    status,
    output: typeof body?.output === "string" ? body.output.slice(0, 10000) : "",
    error_message: typeof body?.errorMessage === "string" ? body.errorMessage.slice(0, 4000) : "",
    external_run_id: typeof body?.externalRunId === "string" ? body.externalRunId.slice(0, 200) : "",
    updated_at: new Date().toISOString(),
  };
  if (status === "running") patch.started_at = new Date().toISOString();
  if (status === "succeeded" || status === "failed") patch.finished_at = new Date().toISOString();
  const { error } = await createAdminClient().from("platform_automation_runs").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: "No se pudo actualizar la ejecución." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
