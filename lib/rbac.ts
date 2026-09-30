/** Matriz centralizada de RBAC para Admin vs Empleado (agente).
 *  Fuente única para rutas admin-only, claves de navegación y helpers.
 *  Usado por proxy.ts (Edge) y server actions (Node).
 */

export type DemoRole = "template_admin" | "admin" | "agente";

/** Rutas que requieren rol admin. Sincroniza con lib/site.ts adminNav/crmNav. */
export const ADMIN_ONLY_PATH_PREFIXES = [
  "/admin/equipo",
  "/admin/categorias",
  "/admin/configuracion",
  "/admin/crm/configuracion",
] as const;

export const ADMIN_ONLY_NAV_KEYS = ["equipo", "categorias", "configuracion"] as const;
export const TEMPLATE_ONLY_NAV_KEYS = ["configuracion"] as const;

/** Matriz de permisos por acción. Si se agrega una acción nueva, añadir aquí. */
export const PERMISSIONS = {
  // Propiedades: ambos pueden crear/editar/listar; borrar/publicar restringido según necesidad futura
  "properties:read": ["admin", "agente"],
  "properties:write": ["admin", "agente"],
  "properties:delete": ["admin", "agente"], // hoy ambos; cambiar a ["admin"] si se quiere flujo aprobación
  "properties:publish": ["admin", "agente"],
  // Taxonomía y config
  "categories:manage": ["admin"],
  "locations:manage": ["admin"],
  "team:manage": ["admin"],
  "site-settings:manage": ["template_admin", "admin"],
  // CRM
  "crm:read": ["admin", "agente"],
  "crm:write": ["admin", "agente"],
  "crm:assign_any": ["admin"],
  "crm:manage_pipeline": ["admin"],
  "crm:manage_outbox": ["admin"],
  "crm:manage_templates": ["admin"],
  "crm:bot_mode": ["admin"],
} as const satisfies Record<string, readonly DemoRole[]>;

export function isAdminRole(role: string): boolean {
  return role === "admin";
}

export function isDemoRole(role: string): role is DemoRole {
  return role === "template_admin" || role === "admin" || role === "agente";
}

export function isTemplateAdminRole(role: string): boolean {
  return role === "template_admin";
}

export function isPlatformRole(role: string): boolean {
  return isAdminRole(role) || isTemplateAdminRole(role);
}

export function can(allowed: readonly DemoRole[], role: string): boolean {
  return (allowed as readonly string[]).includes(role);
}

export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PATH_PREFIXES.filter((prefix) => prefix !== "/admin/configuracion").some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isTemplateOnlyPath(pathname: string): boolean {
  return pathname === "/admin/configuracion" || pathname.startsWith("/admin/configuracion/");
}
