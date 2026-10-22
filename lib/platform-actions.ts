"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { isTemplateAdminRole } from "@/lib/demo-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptPlatformSecret, encryptPlatformSecret } from "@/lib/platform-security";
import { isInternalUserEmail, normalizeUsername, usernameToInternalEmail } from "@/lib/user-identifiers";

export type PlatformActionResult =
  | { ok: true; id?: string; temporaryPassword?: string; message?: string }
  | { ok: false; error: string };

const companySchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]*$/, "Use solo letras minúsculas, números y guiones."),
  publicUrl: z.url().or(z.literal("")),
  deploymentUrl: z.url().or(z.literal("")),
  supabaseUrl: z.url().or(z.literal("")),
  supabaseAnonKey: z.string().trim().max(1000),
  supabaseProjectRef: z.string().trim().max(80),
  supabaseServiceRoleKey: z.string().trim().max(3000),
  vercelProjectName: z.string().trim().max(160),
  templateVersion: z.string().trim().max(80),
  targetTemplateVersion: z.string().trim().max(80),
  notes: z.string().trim().max(2000),
});

const userSchema = z.object({
  companyIds: z.array(z.uuid()).min(1, "Seleccione al menos una empresa."),
  fullName: z.string().trim().min(2).max(120),
  username: z.string().trim().transform(normalizeUsername).pipe(z.string().regex(/^[a-z0-9][a-z0-9._-]{2,59}$/, "Use un usuario de 3 a 60 caracteres: letras, números, punto, guion o guion bajo.")),
  email: z.union([z.email().max(160), z.literal("")]).optional().default(""),
  role: z.enum(["company_admin", "designer", "agente"]),
  // El campo es opcional en el formulario. Un valor vacío (incluidos espacios)
  // significa "generar una contraseña temporal", pero nunca permite crear una
  // cuenta sin contraseña.
  temporaryPassword: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(72).optional(),
  ),
  notes: z.string().trim().max(2000),
});

function selectedCompanyIdsForRole(companyIds: string[], role: "company_admin" | "designer" | "agente") {
  const uniqueCompanyIds = [...new Set(companyIds)];
  if (role !== "designer" && uniqueCompanyIds.length !== 1) {
    throw new Error("Solo el diseñador puede tener más de una empresa asignada.");
  }
  return uniqueCompanyIds;
}

const scriptSchema = z.object({
  companyId: z.uuid(),
  scriptKey: z.enum(["apply_migrations", "sync_site_settings", "refresh_search_indexes"]),
});

const managedChatboxSchema = z.object({
  enabled: z.boolean(),
  welcome: z.string().trim().min(1).max(300),
  statusMessage: z.string().trim().min(1).max(160),
  offlineMessage: z.string().trim().min(1).max(300),
  position: z.enum(["left", "right"]),
  launcher: z.string().trim().min(1).max(4),
  assistantEnabled: z.boolean(),
  assistantName: z.string().trim().min(1).max(100),
  assistantInstructions: z.string().trim().max(2000),
  handoffMessage: z.string().trim().min(1).max(300),
  knowledge: z.string().trim().max(12000),
});

export type ManagedChatboxSettings = {
  widget_key: string;
  enabled: boolean;
  welcome: string;
  color: string;
  palette: {
    primaryColor: string;
    accentColor: string;
    adminColor: string;
    backgroundColor: string;
  };
  status_message: string;
  offline_message: string;
  position: "left" | "right";
  launcher: string;
  assistant_enabled: boolean;
  assistant_name: string;
  assistant_instructions: string;
  handoff_message: string;
  knowledge: string;
};

async function requirePlatformAdmin() {
  const session = await getSession();
  if (!session || !isTemplateAdminRole(session.user.role)) {
    return { ok: false as const, error: "No tiene permisos para el panel general." };
  }
  return { ok: true as const, userId: session.user.id };
}

function revalidatePlatform() { revalidatePath("/admin/plataforma"); }

async function audit(input: { actorId?: string; companyId?: string; action: string; entityType: string; entityId?: string; metadata?: Record<string, unknown> }) {
  await createAdminClient().from("platform_audit_log").insert({
    actor_id: input.actorId ?? null,
    company_id: input.companyId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? "",
    metadata: input.metadata ?? {},
  });
}

async function getCompany(id: string) {
  const { data, error } = await createAdminClient().from("managed_companies").select("*").eq("id", id).single();
  if (error || !data) throw new Error("Empresa no encontrada.");
  return data;
}

async function dispatchAutomation(input: {
  runId: string;
  companyId: string;
  scriptKey: string;
}): Promise<{ dispatched: boolean; error?: string }> {
  const runnerUrl = process.env.PLATFORM_RUNNER_URL?.replace(/\/$/, "");
  if (!runnerUrl) return { dispatched: false, error: "PLATFORM_RUNNER_URL no está configurada." };

  try {
    const response = await fetch(`${runnerUrl}/runs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.PLATFORM_RUNNER_TOKEN ?? ""}`,
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return { dispatched: false, error: `El ejecutor respondió HTTP ${response.status}.` };
    }
    return { dispatched: true };
  } catch {
    return { dispatched: false, error: "No se pudo contactar al ejecutor." };
  }
}

function remoteClient(company: { supabase_url: string; supabase_service_role_key_encrypted: string }): SupabaseClient {
  const serviceKey = decryptPlatformSecret(company.supabase_service_role_key_encrypted);
  if (!company.supabase_url || !serviceKey) throw new Error("La conexión segura de esta empresa no está configurada.");
  return createClient(company.supabase_url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

function remoteRole(role: "company_admin" | "designer" | "agente") {
  return role === "company_admin" ? "admin" : role === "designer" ? "designer" : "agente";
}

function generatedPassword() { return `M2-${randomBytes(12).toString("base64url")}`; }

function assignedCompanyMetadata(companies: Array<{ id: string; name: string; slug?: string | null; public_url?: string | null; deployment_url?: string | null }>) {
  return companies.map((company) => ({
    id: company.id,
    name: company.name,
    url: company.public_url?.trim() || company.deployment_url?.trim() || "",
    adminPath: company.slug?.trim() || "",
  }));
}

function remoteUserMetadata(fullName: string, username: string, companies: Array<{ id: string; name: string; slug?: string | null; public_url?: string | null; deployment_url?: string | null }>) {
  return {
    full_name: fullName,
    username,
    assigned_companies: assignedCompanyMetadata(companies),
  };
}

export async function createManagedCompany(input: unknown): Promise<PlatformActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const data = parsed.data;
  let encryptedServiceKey = "";
  try { encryptedServiceKey = data.supabaseServiceRoleKey ? encryptPlatformSecret(data.supabaseServiceRoleKey) : ""; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "No se pudo proteger la clave de servicio." }; }
  const { data: company, error } = await createAdminClient().from("managed_companies").insert({
    name: data.name,
    slug: data.slug,
    public_url: data.publicUrl,
    deployment_url: data.deploymentUrl,
    supabase_url: data.supabaseUrl,
    supabase_anon_key: data.supabaseAnonKey,
    supabase_project_ref: data.supabaseProjectRef,
    supabase_service_role_key_encrypted: encryptedServiceKey,
    vercel_project_name: data.vercelProjectName,
    template_version: data.templateVersion || "base",
    target_template_version: data.targetTemplateVersion || data.templateVersion || "base",
    notes: data.notes,
  }).select("id").single();
  if (error) return { ok: false, error: error.code === "23505" ? "Ese identificador de empresa ya existe." : "No se pudo crear la empresa." };
  await audit({ actorId: auth.userId, companyId: company.id, action: "company.created", entityType: "company", entityId: company.id, metadata: { name: data.name } });
  revalidatePlatform();
  return { ok: true, id: company.id };
}

export async function updateManagedCompany(id: string, input: unknown): Promise<PlatformActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const parsed = companySchema.extend({ status: z.enum(["active", "paused", "archived"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const data = parsed.data;
  const patch: Record<string, unknown> = {
    name: data.name, slug: data.slug, public_url: data.publicUrl, deployment_url: data.deploymentUrl,
    supabase_url: data.supabaseUrl, supabase_anon_key: data.supabaseAnonKey,
    supabase_project_ref: data.supabaseProjectRef, vercel_project_name: data.vercelProjectName,
    template_version: data.templateVersion, target_template_version: data.targetTemplateVersion,
    notes: data.notes, status: data.status,
  };
  if (data.supabaseServiceRoleKey) {
    try { patch.supabase_service_role_key_encrypted = encryptPlatformSecret(data.supabaseServiceRoleKey); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "No se pudo proteger la clave de servicio." }; }
  }
  const { error } = await createAdminClient().from("managed_companies").update(patch).eq("id", id);
  if (error) return { ok: false, error: "No se pudo actualizar la empresa." };
  await audit({ actorId: auth.userId, companyId: id, action: "company.updated", entityType: "company", entityId: id });
  revalidatePlatform();
  return { ok: true, id };
}

export async function archiveManagedCompany(id: string): Promise<PlatformActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const { error } = await createAdminClient().from("managed_companies").update({ status: "archived" }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo archivar la empresa." };
  await audit({ actorId: auth.userId, companyId: id, action: "company.archived", entityType: "company", entityId: id });
  revalidatePlatform();
  return { ok: true, id };
}

export async function createManagedUser(input: unknown): Promise<PlatformActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const parsed = userSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const data = parsed.data;
  let companyIds: string[];
  try { companyIds = selectedCompanyIdsForRole(data.companyIds, data.role); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Asignaciones no válidas." }; }
  const admin = createAdminClient();
  const { data: companies, error: companiesError } = await admin.from("managed_companies").select("*").in("id", companyIds);
  if (companiesError || !companies || companies.length !== companyIds.length) return { ok: false, error: "Una o más empresas no existen o no están disponibles." };
  const email = data.email?.trim().toLowerCase() || usernameToInternalEmail(data.username);
  const password = data.temporaryPassword ?? generatedPassword();
  const assignedCompanies = companyIds
    .map((companyId) => companies.find((company) => company.id === companyId))
    .filter((company): company is typeof companies[number] => Boolean(company));
  const createdAccounts: Array<{ company: typeof companies[number]; authUserId: string }> = [];
  try {
    for (const companyId of companyIds) {
      const company = companies.find((item) => item.id === companyId);
      if (!company) throw new Error("Empresa no encontrada.");
      const remote = remoteClient(company);
      const created = await remote.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: remoteUserMetadata(data.fullName, data.username, assignedCompanies) });
      if (created.error || !created.data.user) throw new Error(created.error?.message ?? "No se pudo crear la cuenta externa.");
      const { error: profileError } = await remote.from("profiles").upsert({ id: created.data.user.id, full_name: data.fullName, email, role: remoteRole(data.role), is_active: true }, { onConflict: "id" });
      if (profileError) {
        await remote.auth.admin.deleteUser(created.data.user.id);
        throw new Error("La cuenta se creó, pero no se pudo configurar su perfil.");
      }
      createdAccounts.push({ company, authUserId: created.data.user.id });
    }
  } catch (error) {
    await Promise.allSettled(createdAccounts.map(({ company, authUserId }) => remoteClient(company).auth.admin.deleteUser(authUserId)));
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo crear la cuenta en todas las empresas." };
  }

  const identityId = randomUUID();
  const { data: localUsers, error } = await admin.from("managed_users").insert(createdAccounts.map(({ company, authUserId }) => ({
    identity_id: identityId,
    company_id: company.id,
    auth_user_id: authUserId,
    full_name: data.fullName,
    email,
    role: data.role,
    notes: data.notes,
  }))).select("id");
  if (error || !localUsers?.length) {
    await Promise.allSettled(createdAccounts.map(({ company, authUserId }) => remoteClient(company).auth.admin.deleteUser(authUserId)));
    return { ok: false, error: error?.code === "23505" ? "Ese usuario ya está registrado en una de las empresas seleccionadas." : "No se pudo registrar el usuario en el panel general." };
  }
  await audit({ actorId: auth.userId, companyId: companyIds[0], action: "user.created", entityType: "managed_user", entityId: localUsers[0].id, metadata: { role: data.role, username: data.username, companyIds } });
  revalidatePlatform();
  return { ok: true, id: localUsers[0].id, temporaryPassword: password, message: companyIds.length > 1 ? "Diseñador creado y asignado a las empresas seleccionadas. La contraseña temporal solo se muestra ahora." : "Cuenta creada. La contraseña temporal solo se muestra ahora." };
}

async function getManagedUserGroup(id: string) {
  const admin = createAdminClient();
  const { data: current, error: currentError } = await admin.from("managed_users").select("*, managed_companies(*)").eq("id", id).single();
  if (currentError || !current) return { admin, current: null, rows: [], error: "Usuario no encontrado." };
  const identityId = current.identity_id ?? current.id;
  const { data: rows, error } = await admin.from("managed_users").select("*, managed_companies(*)").eq("identity_id", identityId);
  if (error || !rows?.length) return { admin, current, rows: [current], error: "No se pudieron cargar las empresas asignadas." };
  return { admin, current, rows, error: null };
}

export async function updateManagedUser(id: string, input: unknown): Promise<PlatformActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const parsed = userSchema.omit({ temporaryPassword: true }).extend({ isActive: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  let companyIds: string[];
  try { companyIds = selectedCompanyIdsForRole(parsed.data.companyIds, parsed.data.role); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Asignaciones no válidas." }; }
  const group = await getManagedUserGroup(id);
  if (group.error || !group.current) return { ok: false, error: group.error ?? "Usuario no encontrado." };
  const current = group.current;
  const currentRows = group.rows;
  const { data: companies, error: companiesError } = await group.admin.from("managed_companies").select("*").in("id", companyIds);
  if (companiesError || !companies || companies.length !== companyIds.length) return { ok: false, error: "Una o más empresas no existen o no están disponibles." };
  const existingByCompany = new Map(currentRows.map((row) => [row.company_id, row]));
  const addedCompanyIds = companyIds.filter((companyId) => !existingByCompany.has(companyId));
  const requestedEmail = parsed.data.email?.trim().toLowerCase();
  const nextEmail = requestedEmail || (isInternalUserEmail(current.email) ? usernameToInternalEmail(parsed.data.username) : current.email);
  const passwordForNewAssignments = addedCompanyIds.length > 0 ? generatedPassword() : undefined;
  const assignedCompanies = companyIds
    .map((companyId) => companies.find((company) => company.id === companyId))
    .filter((company): company is typeof companies[number] => Boolean(company));
  const createdAccounts: Array<{ company: typeof companies[number]; authUserId: string }> = [];

  try {
    for (const companyId of companyIds) {
      const company = companies.find((item) => item.id === companyId);
      if (!company) throw new Error("Empresa no encontrada.");
      const existing = existingByCompany.get(companyId);
      const remote = remoteClient(company);
      if (existing?.auth_user_id) {
        const update = { email: nextEmail, user_metadata: remoteUserMetadata(parsed.data.fullName, parsed.data.username, assignedCompanies), ...(passwordForNewAssignments ? { password: passwordForNewAssignments } : {}) };
        const remoteUser = await remote.auth.admin.updateUserById(existing.auth_user_id, update);
        if (remoteUser.error) throw new Error(remoteUser.error.message);
        const { error: profileError } = await remote.from("profiles").update({ full_name: parsed.data.fullName, email: nextEmail, role: remoteRole(parsed.data.role), is_active: parsed.data.isActive }).eq("id", existing.auth_user_id);
        if (profileError) throw new Error("No se pudo actualizar el perfil de una de las empresas.");
        continue;
      }

      const created = await remote.auth.admin.createUser({ email: nextEmail, password: passwordForNewAssignments ?? generatedPassword(), email_confirm: true, user_metadata: remoteUserMetadata(parsed.data.fullName, parsed.data.username, assignedCompanies) });
      if (created.error || !created.data.user) throw new Error(created.error?.message ?? "No se pudo crear la cuenta externa.");
      const { error: profileError } = await remote.from("profiles").upsert({ id: created.data.user.id, full_name: parsed.data.fullName, email: nextEmail, role: remoteRole(parsed.data.role), is_active: parsed.data.isActive }, { onConflict: "id" });
      if (profileError) {
        await remote.auth.admin.deleteUser(created.data.user.id);
        throw new Error("La cuenta se creó, pero no se pudo configurar su perfil.");
      }
      createdAccounts.push({ company, authUserId: created.data.user.id });
    }

    for (const row of currentRows) {
      if (companyIds.includes(row.company_id)) continue;
      const company = Array.isArray(row.managed_companies) ? row.managed_companies[0] : row.managed_companies;
      if (row.auth_user_id && company) {
        const remote = remoteClient(company);
        const remoteUser = await remote.auth.admin.updateUserById(row.auth_user_id, {
          user_metadata: remoteUserMetadata(parsed.data.fullName, parsed.data.username, assignedCompanies),
        });
        if (remoteUser.error) throw new Error(remoteUser.error.message);
        const { error: profileError } = await remote.from("profiles").update({ is_active: false }).eq("id", row.auth_user_id);
        if (profileError) throw new Error("No se pudo desactivar el acceso de una empresa anterior.");
      }
    }
  } catch (error) {
    await Promise.allSettled(createdAccounts.map(({ company, authUserId }) => remoteClient(company).auth.admin.deleteUser(authUserId)));
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo actualizar la cuenta en todas las empresas." };
  }

  const identityId = current.identity_id ?? current.id;
  for (const row of currentRows) {
    const { error } = await group.admin.from("managed_users").update({ full_name: parsed.data.fullName, email: nextEmail, role: parsed.data.role, notes: parsed.data.notes, is_active: companyIds.includes(row.company_id) ? parsed.data.isActive : false }).eq("id", row.id);
    if (error) return { ok: false, error: error.code === "23505" ? "Ese usuario o email ya está registrado para una empresa." : "No se pudo actualizar el usuario." };
  }
  if (createdAccounts.length > 0) {
    const { error } = await group.admin.from("managed_users").insert(createdAccounts.map(({ company, authUserId }) => ({ identity_id: identityId, company_id: company.id, auth_user_id: authUserId, full_name: parsed.data.fullName, email: nextEmail, role: parsed.data.role, notes: parsed.data.notes, is_active: parsed.data.isActive })));
    if (error) return { ok: false, error: error.code === "23505" ? "Ese usuario o email ya está registrado para una empresa." : "No se pudo guardar la nueva asignación." };
  }
  await audit({ actorId: auth.userId, companyId: current.company_id, action: "user.updated", entityType: "managed_user", entityId: id, metadata: { companyIds } });
  revalidatePlatform();
  return { ok: true, id, ...(passwordForNewAssignments ? { temporaryPassword: passwordForNewAssignments, message: "Asignaciones actualizadas. Se generó una nueva contraseña temporal para mantener el mismo acceso en las empresas añadidas." } : {}) };
}

export async function archiveManagedUser(id: string): Promise<PlatformActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const group = await getManagedUserGroup(id);
  if (group.error || !group.current) return { ok: false, error: group.error ?? "Usuario no encontrado." };
  try {
    for (const row of group.rows) {
      const company = Array.isArray(row.managed_companies) ? row.managed_companies[0] : row.managed_companies;
      if (row.auth_user_id && company) await remoteClient(company).from("profiles").update({ is_active: false }).eq("id", row.auth_user_id);
    }
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "No se pudo desactivar una de las cuentas externas." }; }
  const { error } = await group.admin.from("managed_users").update({ is_active: false }).eq("identity_id", group.current.identity_id ?? group.current.id);
  if (error) return { ok: false, error: "No se pudo desactivar el usuario." };
  await audit({ actorId: auth.userId, companyId: group.current.company_id, action: "user.deactivated", entityType: "managed_user", entityId: id, metadata: { companyIds: group.rows.map((row) => row.company_id) } });
  revalidatePlatform();
  return { ok: true, id };
}

export async function deleteManagedUser(id: string): Promise<PlatformActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const group = await getManagedUserGroup(id);
  if (group.error || !group.current) return { ok: false, error: group.error ?? "Usuario no encontrado." };
  try {
    for (const row of group.rows) {
      const company = Array.isArray(row.managed_companies) ? row.managed_companies[0] : row.managed_companies;
      if (row.auth_user_id && company) {
        const result = await remoteClient(company).auth.admin.deleteUser(row.auth_user_id);
        if (result.error) return { ok: false, error: result.error.message };
      }
    }
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "No se pudo eliminar una de las cuentas externas." }; }
  const { error } = await group.admin.from("managed_users").delete().eq("identity_id", group.current.identity_id ?? group.current.id);
  if (error) return { ok: false, error: "La cuenta externa fue eliminada, pero no se pudo borrar el registro central." };
  await audit({ actorId: auth.userId, companyId: group.current.company_id, action: "user.deleted", entityType: "managed_user", entityId: id, metadata: { companyIds: group.rows.map((row) => row.company_id) } });
  revalidatePlatform();
  return { ok: true, id };
}

export async function resetManagedUserPassword(id: string): Promise<PlatformActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const group = await getManagedUserGroup(id);
  if (group.error || !group.current || !group.rows.some((row) => row.auth_user_id)) return { ok: false, error: group.error ?? "Usuario no encontrado o sin cuenta externa." };
  const password = generatedPassword();
  try {
    for (const row of group.rows) {
      const company = Array.isArray(row.managed_companies) ? row.managed_companies[0] : row.managed_companies;
      if (row.auth_user_id && company) {
        const result = await remoteClient(company).auth.admin.updateUserById(row.auth_user_id, { password });
        if (result.error) return { ok: false, error: result.error.message };
      }
    }
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "No se pudo restablecer la contraseña." }; }
  await group.admin.from("managed_users").update({ last_password_reset_at: new Date().toISOString() }).eq("identity_id", group.current.identity_id ?? group.current.id);
  await audit({ actorId: auth.userId, companyId: group.current.company_id, action: "user.password_reset", entityType: "managed_user", entityId: id, metadata: { companyIds: group.rows.map((row) => row.company_id) } });
  revalidatePlatform();
  return { ok: true, id, temporaryPassword: password, message: "Contraseña restablecida. Solo se muestra ahora." };
}

export async function checkManagedCompanyHealth(id: string): Promise<PlatformActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const company = await getCompany(id);
  const url = company.public_url || company.deployment_url;
  let siteOk = false;
  try { if (url) { const response = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" }); siteOk = response.ok; } } catch { siteOk = false; }
  let dbOk = false;
  try { const response = await fetch(`${company.supabase_url}/rest/v1/site_settings?select=id&limit=1`, { headers: { apikey: company.supabase_anon_key, Authorization: `Bearer ${company.supabase_anon_key}` }, signal: AbortSignal.timeout(8000), cache: "no-store" }); dbOk = response.ok; } catch { dbOk = false; }
  const status = siteOk && dbOk ? "healthy" : siteOk || dbOk ? "degraded" : "offline";
  const { error } = await createAdminClient().from("managed_companies").update({ health_status: status, last_health_check_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo guardar el estado de salud." };
  await audit({ actorId: auth.userId, companyId: id, action: "company.health_checked", entityType: "company", entityId: id, metadata: { status, siteOk, dbOk } });
  revalidatePlatform();
  return { ok: true, id, message: status };
}

export async function queuePlatformAutomation(input: unknown): Promise<PlatformActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const parsed = scriptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Tarea no válida." };
  const { data, error } = await createAdminClient().from("platform_automation_runs").insert({ company_id: parsed.data.companyId, script_key: parsed.data.scriptKey, status: "queued", executor: process.env.PLATFORM_RUNNER_URL ? "internal-runner" : "pending", requested_by: auth.userId ?? null }).select("id").single();
  if (error) return { ok: false, error: "No se pudo poner la tarea en cola." };
  await audit({ actorId: auth.userId, companyId: parsed.data.companyId, action: "automation.queued", entityType: "automation_run", entityId: data.id, metadata: { scriptKey: parsed.data.scriptKey } });
  const dispatch = await dispatchAutomation({ runId: data.id, companyId: parsed.data.companyId, scriptKey: parsed.data.scriptKey });
  if (process.env.PLATFORM_RUNNER_URL && !dispatch.dispatched) {
    await createAdminClient().from("platform_automation_runs").update({ status: "failed", error_message: dispatch.error ?? "No se pudo enviar la tarea.", updated_at: new Date().toISOString() }).eq("id", data.id);
  }
  revalidatePlatform();
  return { ok: true, id: data.id, message: process.env.PLATFORM_RUNNER_URL ? (dispatch.dispatched ? "Tarea enviada al ejecutor." : "Tarea registrada como fallida: revise el ejecutor.") : "Tarea en cola: falta configurar PLATFORM_RUNNER_URL." };
}

export async function retryPlatformAutomation(id: string): Promise<PlatformActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const { data: run, error: readError } = await createAdminClient().from("platform_automation_runs").select("id, company_id, script_key, attempts, max_attempts").eq("id", id).single();
  if (readError || !run) return { ok: false, error: "Ejecución no encontrada." };
  if (run.attempts >= run.max_attempts) return { ok: false, error: "Se alcanzó el máximo de reintentos configurado." };
  const { error } = await createAdminClient().from("platform_automation_runs").update({ status: "queued", attempts: run.attempts + 1, error_message: "", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo reintentar la tarea." };
  const dispatch = await dispatchAutomation({ runId: run.id, companyId: run.company_id, scriptKey: run.script_key });
  if (process.env.PLATFORM_RUNNER_URL && !dispatch.dispatched) {
    await createAdminClient().from("platform_automation_runs").update({ status: "failed", error_message: dispatch.error ?? "No se pudo enviar la tarea.", updated_at: new Date().toISOString() }).eq("id", id);
  }
  await audit({ actorId: auth.userId, companyId: run.company_id, action: "automation.retried", entityType: "automation_run", entityId: id, metadata: { scriptKey: run.script_key, attempt: run.attempts + 1 } });
  revalidatePlatform();
  return { ok: true, id, message: process.env.PLATFORM_RUNNER_URL ? (dispatch.dispatched ? "Tarea reenviada al ejecutor." : "Reintento registrado como fallido: revise el ejecutor.") : "Tarea puesta nuevamente en cola; falta configurar PLATFORM_RUNNER_URL." };
}

function safePaletteColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback;
}

const defaultManagedChatbox: ManagedChatboxSettings = {
  widget_key: "",
  enabled: true,
  welcome: "Hola, ¿cómo podemos ayudarte?",
  color: "#506600",
  palette: {
    primaryColor: "#506600",
    accentColor: "#a4c639",
    adminColor: "#5e5e5e",
    backgroundColor: "#f8f9fa",
  },
  status_message: "Normalmente respondemos pronto.",
  offline_message: "Estamos fuera de horario. Déjanos tu mensaje.",
  position: "right",
  launcher: "💬",
  assistant_enabled: true,
  assistant_name: "Asistente virtual",
  assistant_instructions: "Responde con amabilidad, brevedad y únicamente con información confirmada.",
  handoff_message: "Voy a transferir esta conversación a una persona del equipo para ayudarte mejor.",
  knowledge: "",
};

export type ManagedChatboxActionResult =
  | { ok: true; settings: ManagedChatboxSettings; installBaseUrl: string }
  | { ok: false; error: string };

export async function getManagedCompanyChatbox(companyId: string): Promise<ManagedChatboxActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  if (!z.uuid().safeParse(companyId).success) return { ok: false, error: "Empresa no válida." };
  try {
    const company = await getCompany(companyId);
    const remote = remoteClient(company);
    const { data, error } = await remote
      .from("chatbox_settings")
      .select("widget_key, enabled, welcome, color, status_message, offline_message, position, launcher, assistant_enabled, assistant_name, assistant_instructions, handoff_message, knowledge")
      .eq("id", 1)
      .maybeSingle();
    if (error) return { ok: false, error: "No se pudo leer el chatbox remoto. Aplique primero la migración de chatbox." };
    const { data: siteData } = await remote
      .from("site_settings")
      .select("primary_color, accent_color, admin_color, background_color")
      .eq("id", 1)
      .maybeSingle();
    const palette = {
      primaryColor: safePaletteColor(siteData?.primary_color, defaultManagedChatbox.palette.primaryColor),
      accentColor: safePaletteColor(siteData?.accent_color, defaultManagedChatbox.palette.accentColor),
      adminColor: safePaletteColor(siteData?.admin_color, defaultManagedChatbox.palette.adminColor),
      backgroundColor: safePaletteColor(siteData?.background_color, defaultManagedChatbox.palette.backgroundColor),
    };
    return {
      ok: true,
      settings: { ...defaultManagedChatbox, ...(data ?? {}), color: palette.primaryColor, palette } as ManagedChatboxSettings,
      installBaseUrl: String(company.public_url || company.deployment_url || "").replace(/\/$/, ""),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo conectar con la empresa." };
  }
}

export async function saveManagedCompanyChatbox(companyId: string, input: unknown): Promise<PlatformActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  if (!z.uuid().safeParse(companyId).success) return { ok: false, error: "Empresa no válida." };
  const parsed = managedChatboxSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  try {
    const company = await getCompany(companyId);
    const remote = remoteClient(company);
    const { data: current } = await remote.from("chatbox_settings").select("widget_key").eq("id", 1).maybeSingle();
    const { data: siteData } = await remote.from("site_settings").select("primary_color").eq("id", 1).maybeSingle();
    const primaryColor = safePaletteColor(siteData?.primary_color, "#506600");
    const { error } = await remote.from("chatbox_settings").upsert(
      {
        id: 1,
        widget_key: current?.widget_key || randomUUID(),
        enabled: parsed.data.enabled,
        welcome: parsed.data.welcome,
        // Se conserva también el valor persistido para compatibilidad, pero el
        // widget siempre resuelve el color actual desde site_settings.
        color: primaryColor,
        status_message: parsed.data.statusMessage,
        offline_message: parsed.data.offlineMessage,
        position: parsed.data.position,
        launcher: parsed.data.launcher,
        assistant_enabled: parsed.data.assistantEnabled,
        assistant_name: parsed.data.assistantName,
        assistant_instructions: parsed.data.assistantInstructions,
        handoff_message: parsed.data.handoffMessage,
        knowledge: parsed.data.knowledge,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) return { ok: false, error: "No se pudo guardar el chatbox remoto. Aplique primero la migración de chatbox." };
    await audit({ actorId: auth.userId, companyId, action: "company.chatbox_updated", entityType: "chatbox_settings", entityId: companyId });
    revalidatePlatform();
    return { ok: true, id: companyId, message: "Configuración del chatbox guardada en la empresa." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo conectar con la empresa." };
  }
}
