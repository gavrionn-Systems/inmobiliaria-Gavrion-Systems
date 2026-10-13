import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/site-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value.replace(/[&<>'\"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&apos;",
    '"': "&quot;",
  })[character] ?? character);
}

function safeColor(value: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

export async function GET() {
  const settings = await getSiteSettings();
  const initial = escapeXml(settings.name.trim().charAt(0).toUpperCase() || "I");
  const primary = safeColor(settings.primaryColor, "#506600");
  const accent = safeColor(settings.accentColor, "#a4c639");
  const admin = safeColor(settings.adminColor, "#5e5e5e");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="16" fill="${primary}"/>
  <circle cx="32" cy="32" r="22" fill="${accent}"/>
  <text x="32" y="42" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="${admin}">${initial}</text>
</svg>`;
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
