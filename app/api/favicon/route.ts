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

function brandInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "I";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export async function GET() {
  const settings = await getSiteSettings();
  const initials = brandInitials(settings.name);
  const primary = safeColor(settings.primaryColor, "#506600");
  const accent = safeColor(settings.accentColor, "#a4c639");
  const admin = safeColor(settings.adminColor, "#5e5e5e");
  const fontSize = initials.length > 1 ? 21 : 28;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="16" fill="${primary}"/>
  <circle cx="32" cy="32" r="22" fill="${accent}"/>
  <text x="32" y="40" text-anchor="middle" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="700" letter-spacing="1" fill="${admin}">${escapeXml(initials)}</text>
</svg>`;
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
