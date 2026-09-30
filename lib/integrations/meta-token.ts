import "server-only";

/** Token server-only para leer plantillas y bajar media. El envío de
 *  mensajería externa; esta copia opcional acepta el alias histórico
 *  META_TEMPLATES_TOKEN. */
export function metaWhatsappToken(): string {
  return (
    process.env.META_WHATSAPP_TOKEN ?? process.env.META_TEMPLATES_TOKEN ?? ""
  );
}
