import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function encryptionKeys() {
  const values = [process.env.PLATFORM_ENCRYPTION_KEY, process.env.AUTH_SECRET]
    .filter((value): value is string => Boolean(value));
  if (values.length === 0) {
    throw new Error("Configure PLATFORM_ENCRYPTION_KEY en Vercel; AUTH_SECRET tampoco está disponible.");
  }
  return values.map((value) => createHash("sha256").update(value).digest());
}

export function encryptPlatformSecret(value: string) {
  if (!value) return "";
  const iv = randomBytes(12);
  // PLATFORM_ENCRYPTION_KEY es la opción recomendada. AUTH_SECRET permite
  // recuperar el panel mientras se completa esa variable en instalaciones
  // existentes, sin guardar la clave en el navegador.
  const cipher = createCipheriv("aes-256-gcm", encryptionKeys()[0], iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptPlatformSecret(payload: string) {
  if (!payload) return "";
  const [ivValue, tagValue, encryptedValue] = payload.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Secreto cifrado inválido.");
  const iv = Buffer.from(ivValue, "base64url");
  const tag = Buffer.from(tagValue, "base64url");
  const encrypted = Buffer.from(encryptedValue, "base64url");
  for (const key of encryptionKeys()) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    } catch {
      // Prueba la siguiente clave durante una rotación o transición.
    }
  }
  throw new Error("No se pudo descifrar la clave de servicio almacenada.");
}
