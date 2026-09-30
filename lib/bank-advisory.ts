const BANK_ADVISORY_KEYWORDS = [
  "asesoria bancaria",
  "credito",
  "prestamo",
  "financiamiento",
  "hipoteca",
  "banco",
  "precalifica",
  "preaprobacion",
  "pre aprobacion",
];

/** Quita mayúsculas y tildes para que la detección sea tolerante. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Una solicitud es de asesoría bancaria si su asunto o mensaje menciona
 *  crédito, financiamiento o temas relacionados. Se gestiona de forma manual
 *  por su complejidad, pero queda registrada en el CRM. */
export function isBankAdvisoryRequest(
  ...parts: Array<string | null | undefined>
): boolean {
  const haystack = normalize(parts.filter(Boolean).join(" "));
  if (!haystack) return false;
  return BANK_ADVISORY_KEYWORDS.some((keyword) => haystack.includes(keyword));
}
