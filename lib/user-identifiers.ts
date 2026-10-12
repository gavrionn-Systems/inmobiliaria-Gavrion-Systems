const INTERNAL_EMAIL_DOMAIN = "usuarios.invalid";

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{2,59}$/.test(normalizeUsername(value));
}

export function usernameToInternalEmail(username: string): string {
  return `${normalizeUsername(username)}@${INTERNAL_EMAIL_DOMAIN}`;
}

export function isInternalUserEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${INTERNAL_EMAIL_DOMAIN}`);
}

export function usernameFromStoredEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  return isInternalUserEmail(normalized)
    ? normalized.slice(0, -(`@${INTERNAL_EMAIL_DOMAIN}`).length)
    : "";
}

/** Acepta emails existentes y convierte usuarios nuevos en su email técnico. */
export function loginIdentifierToEmail(identifier: string): string {
  const normalized = identifier.trim().toLowerCase();
  if (normalized.includes("@")) return normalized;
  return isValidUsername(normalized) ? usernameToInternalEmail(normalized) : "";
}
