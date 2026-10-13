import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/site-settings";
import { getChatboxSettings, safeWidgetColor, widgetKeyIsValid } from "@/lib/chatbox";

export const runtime = "nodejs";

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request.headers.get("origin")) });
}

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const key = new URL(request.url).searchParams.get("key");
  const settings = await getChatboxSettings();
  if (!key || !widgetKeyIsValid(key, settings)) {
    return NextResponse.json({ error: "Widget no disponible" }, { status: 404, headers: cors(origin) });
  }

  const site = await getSiteSettings();
  return NextResponse.json(
    {
      enabled: settings.enabled,
      company: site.name,
      logoUrl: site.logoUrl,
      welcome: settings.welcome,
      // El chatbox hereda la paleta vigente del sitio, no una copia antigua
      // guardada en la configuración del widget.
      color: safeWidgetColor(site.primaryColor),
      statusMessage: settings.status_message,
      offlineMessage: settings.offline_message,
      position: settings.position,
      launcher: settings.launcher,
    },
    { headers: cors(origin) },
  );
}
