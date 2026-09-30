/** Convierte número o URL de settings en un enlace wa.me. */
export function toWhatsAppHref(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value || value === "#") return null;

  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();

    if (host === "wa.me") {
      const digits = url.pathname.replace(/\D/g, "");
      if (digits.length >= 8) {
        return `https://wa.me/${digits}${url.search}`;
      }
    }

    if (host === "api.whatsapp.com" || host === "whatsapp.com") {
      const phone = url.searchParams.get("phone")?.replace(/\D/g, "") ?? "";
      if (phone.length >= 8) {
        const text = url.searchParams.get("text");
        const query = text ? `?text=${encodeURIComponent(text)}` : "";
        return `https://wa.me/${phone}${query}`;
      }
    }
  } catch {
    // No es una URL; se trata como teléfono.
  }

  let digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  // Números locales hondureños (8 dígitos) → código de país 504.
  if (digits.length === 8) digits = `504${digits}`;
  if (digits.length < 8) return null;

  return `https://wa.me/${digits}`;
}
