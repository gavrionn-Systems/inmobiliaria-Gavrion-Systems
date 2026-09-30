import { NextResponse } from "next/server";
import { safeEqualText } from "@/lib/integrations/signatures";
import { syncWhatsappTemplates } from "@/lib/integrations/templates";

function isAuthorized(request: Request): boolean {
  const expectedToken = process.env.CRON_SECRET ?? "";
  const suppliedToken = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  return Boolean(
    expectedToken && suppliedToken && safeEqualText(suppliedToken, expectedToken)
  );
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncWhatsappTemplates();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ fetched: result.fetched, upserted: result.upserted });
}

// Vercel Cron invoca con GET (cron diario definido en vercel.json).
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
