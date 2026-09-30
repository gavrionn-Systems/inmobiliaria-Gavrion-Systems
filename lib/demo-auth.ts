/** Constantes del acceso de demostración. Sin secretos ni imports de Next —
 *  este módulo también es usado por proxy.ts (Edge). */

export const DEMO_SESSION_COOKIE = "site_session";

/** Prefijo interno real de las rutas del panel. Nunca se expone al público:
 *  el acceso se hace por la ruta secreta (ADMIN_PANEL_PATH) y /admin responde
 *  404 sin sesión (ver proxy.ts). */
export const ADMIN_ROUTE_PREFIX = "/admin";

const DEFAULT_ADMIN_PANEL_SLUG = "acceso-panel";

/** Slug público de entrada al panel, configurable vía ADMIN_PANEL_PATH.
 *  Solo minúsculas, números y guiones; "admin" no está permitido. */
export function adminPanelSlug(): string {
  const raw = process.env.ADMIN_PANEL_PATH
    ?.trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");
  if (raw && /^[a-z0-9][a-z0-9-]*$/.test(raw) && raw !== "admin") {
    return raw;
  }
  return DEFAULT_ADMIN_PANEL_SLUG;
}

/** URL de login del panel usando la ruta secreta (ej. "/acceso-panel/login"). */
export function adminLoginPath(): string {
  return `/${adminPanelSlug()}/login`;
}

import type { DemoRole } from "./rbac";
export type { DemoRole } from "./rbac";

export const DEMO_USER = {
  name: "Administrador de empresa",
  email: "admin@ejemplo.com",
  role: "admin",
} as const satisfies { name: string; email: string; role: DemoRole };

export const DEMO_TEMPLATE_ADMIN = {
  name: "Administrador de plantilla",
  email: "plantilla@ejemplo.com",
  role: "template_admin",
} as const satisfies { name: string; email: string; role: DemoRole };

export const DEMO_EMPLOYEE = {
  name: "Agente Demo",
  email: "agente@ejemplo.com",
  role: "agente",
} as const satisfies { name: string; email: string; role: DemoRole };

export const ROLE_LABELS: Record<DemoRole, string> = {
  template_admin: "Administrador de plantilla",
  admin: "Administrador",
  agente: "Empleado",
};

/** Re-export centralizado desde lib/rbac.ts (fuente única). */
export {
  ADMIN_ONLY_NAV_KEYS,
  ADMIN_ONLY_PATH_PREFIXES,
  isAdminOnlyPath,
  isAdminRole,
  isDemoRole,
  isPlatformRole,
  isTemplateAdminRole,
  isTemplateOnlyPath,
} from "./rbac";

/** Contraseña por defecto SOLO en desarrollo. En producción se ignora y se
 *  usan ADMIN_PASSWORD / EMPLOYEE_PASSWORD (ver lib/auth.ts). */
export const DEV_FALLBACK_PASSWORD = "demo1234";
