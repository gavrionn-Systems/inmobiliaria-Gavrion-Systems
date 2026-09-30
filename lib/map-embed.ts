import "server-only";

const MAPS_LINK_RE =
  /(?:maps\.app\.goo\.gl\/|goo\.gl\/maps\/|(?:www\.)?google\.[a-z.]+\/maps\/)/i;

const embedCache = new Map<string, string | null>();

function zoomFromMeters(meters: number): number {
  if (meters <= 200) return 18;
  if (meters <= 500) return 17;
  if (meters <= 1000) return 16;
  if (meters <= 2000) return 15;
  return 14;
}

function extractCoords(
  url: string
): { lat: string; lng: string; zoom?: number } | null {
  const pin = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (pin) {
    const view = url.match(
      /@(-?\d+\.\d+),(-?\d+\.\d+),(\d+(?:\.\d+)?)(z|m)/
    );
    let zoom = 16;
    if (view?.[4] === "z") zoom = Math.round(Number(view[3]));
    else if (view?.[4] === "m") zoom = zoomFromMeters(Number(view[3]));
    return { lat: pin[1], lng: pin[2], zoom };
  }

  const atZ = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+(?:\.\d+)?)z/);
  if (atZ) {
    return {
      lat: atZ[1],
      lng: atZ[2],
      zoom: Math.round(Number(atZ[3])),
    };
  }

  const atM = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+)m/);
  if (atM) {
    return {
      lat: atM[1],
      lng: atM[2],
      zoom: zoomFromMeters(Number(atM[3])),
    };
  }

  const search =
    url.match(/\/search\/([-+]?\d{1,3}\.\d+)\s*,\s*\+?\s*([-+]?\d{1,3}\.\d+)/) ??
    url.match(/[?&]q=(-?\d{1,3}\.\d+)\s*,\s*\+?\s*(-?\d{1,3}\.\d+)/);
  if (search) {
    return { lat: search[1], lng: search[2] };
  }

  return null;
}

export function isMapsLink(link: string | null | undefined): boolean {
  return typeof link === "string" && MAPS_LINK_RE.test(link);
}

async function resolveLink(link: string): Promise<string | null> {
  try {
    const res = await fetch(link, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    return res.url;
  } catch {
    return null;
  }
}

/** Convierte un enlace de Google Maps en URL de embed iframe.
 *  Si no es un enlace de Maps (o no se puede extraer la ubicación),
 *  devuelve null y el campo debe renderizarse como imagen. */
export async function getMapEmbedUrl(
  link: string | null | undefined
): Promise<string | null> {
  if (!isMapsLink(link)) return null;
  if (embedCache.has(link!)) return embedCache.get(link!) ?? null;

  const resolved = (await resolveLink(link!)) ?? link!;
  const coords = extractCoords(resolved);

  if (!coords) {
    embedCache.set(link!, null);
    return null;
  }

  const { lat, lng } = coords;
  const z = Math.max(10, Math.min(18, coords.zoom ?? 14));
  const embed = `https://maps.google.com/maps?q=${lat},${lng}&z=${z}&output=embed&hl=es`;
  embedCache.set(link!, embed);
  return embed;
}