const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  HNL: "L",
  CRC: "₡",
  MXN: "$",
  EUR: "€",
};

/** Formato regional configurable mediante NEXT_PUBLIC_SITE_LOCALE. */
const LOCALE = process.env.NEXT_PUBLIC_SITE_LOCALE || "es";

export function formatPrice(
  price: number,
  currency: string,
  operation: string
): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? "$";
  const formatted = new Intl.NumberFormat(LOCALE, {
    maximumFractionDigits: 0,
  }).format(price);
  const suffix = operation === "alquiler" ? "/mes" : "";
  return `${symbol}${formatted}${suffix}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/** Etiqueta legible del origen del lead (contacts.source). */
const LEAD_SOURCE_LABELS: Record<string, string> = {
  web_form: "Web",
  web: "Web",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  messenger: "Messenger",
  manual: "Manual",
};

export function leadSourceLabel(source: string | null | undefined): string {
  if (!source) return "Desconocido";
  return LEAD_SOURCE_LABELS[source] ?? source;
}

/** Etiqueta legible del canal de una conversación (conversations.channel). */
const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  web: "Web",
  instagram: "Instagram",
  messenger: "Messenger",
};

export function channelLabel(channel: string | null | undefined): string {
  if (!channel) return "Otro";
  return CHANNEL_LABELS[channel] ?? channel;
}
