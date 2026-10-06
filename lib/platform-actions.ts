"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { isTemplateAdminRole } from "@/lib/demo-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptPlatformSecret, encryptPlatformSecret } from "@/lib/platform-security";

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
  companyId: z.uuid(),
  fullName: z.string().trim().min(2).max(120),
  email: z.email().max(160),
  role: z.enum(["company_admin", "designer", "agente"]),
  temporaryPassword: z.string().min(8).max(72).optional(),
  notes: z.string().trim().max(2000),
});

const scriptSchema = z.object({
  companyId: z.uuid(),
  scriptKey: z.enum(["apply_migrations", "sync_site_settings", "refresh_search_indexes"]),
});

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

function remoteClient(company: { supabase_url: string; supabase_service_role_key_encrypted: string }): SupabaseClient {
  const serviceKey = decryptPlatformSecret(company.supabase_service_role_key_encrypted);
  if (!company.supabase_url || !serviceKey) throw new Error("La conexión segura de esta empresa no está configurada.");
  return createClient(company.supabase_url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

function remoteRole(role: "company_admin" | "designer" | "agente") {
  return role === "company_admin" ? "admin" : role === "designer" ? "designer" : "agente";
}

function generatedPassword() { return `M2-${randomBytes(12).toString("base64url")}`; }

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
  let company;
  try { company = await getCompany(data.companyId); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Empresa no encontrada." }; }
  let remote;
  try { remote = remoteClient(company); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Conexión no configurada." }; }
  const password = data.temporaryPassword || generatedPassword();
  const created = await remote.auth.admin.createUser({ email: data.email.trim().toLowerCase(), password, email_confirm: true, user_metadata: { full_name: data.fullName } });
  if (created.error || !created.data.user) return { ok: false, error: created.error?.message ?? "No se pudo crear la cuenta externa." };
  const { error: profileError } = await remote.from("profiles").upsert({ id: created.data.user.id, full_name: data.fullName, email: data.email.trim().toLowerCase(), role: remoteRole(data.role), is_active: true }, { onConflict: "id" });
  if (profileError) { await remote.auth.admin.deleteUser(created.data.user.id); return { ok: false, error: "La cuenta se creó, pero no se pudo configurar su perfil." }; }
  const { data: localUser, error } = await createAdminClient().from("managed_users").insert({ company_id: data.companyId, auth_user_id: created.data.user.id, full_name: data.fullName, email: data.email.trim().toLowerCase(), role: data.role, notes: data.notes }).select("id").single();
  if (error) { await remote.auth.admin.deleteUser(created.data.user.id); return { ok: false, error: error.code === "23505" ? "Ese email ya está registrado para la empresa." : "No se pudo registrar el usuario en el panel general." }; }
  await audit({ actorId: auth.userId, companyId: data.companyId, action: "user.created", entityType: "managed_user", entityId: localUser.id, metadata: { role: data.role, email: data.email } });
  revalidatePlatform();
  return { ok: true, id: localUser.id, temporaryPassword: password, message: "Cuenta creada. La contraseña temporal solo se muestra ahora." };
}

export async function updateManagedUser(id: string, input: unknown): Promise<PlatformActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const parsed = userSchema.omit({ companyId: true, temporaryPassword: true }).extend({ isActive: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const { data: current, error: currentError } = await createAdminClient().from("managed_users").select("*, managed_companies(*)").eq("id", id).single();
  if (currentError || !current) return { ok: false, error: "Usuario no encontrado." };
  const company = Array.isArray(current.managed_companies) ? current.managed_companies[0] : current.managed_companies;
  try {
    const remote = remoteClient(company);
    if (current.auth_user_id) await remote.auth.admin.updateUserById(current.auth_user_id, { email: parsed.data.email.trim().toLowerCase(), user_metadata: { full_name: parsed.data.fullName } });
    if (current.auth_user_id) await remote.from("profiles").update({ full_name: parsed.data.fullName, email: parsed.data.email.trim().toLowerCase(), role: remoteRole(parsed.data.role), is_active: parsed.data.isActive }).eq("id", current.auth_user_id);
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "No se pudo actualizar la cuenta externa." }; }
  const { error } = await createAdminClient().from("managed_users").update({ full_name: parsed.data.fullName, email: parsed.data.email.trim().toLowerCase(), role: parsed.data.role, notes: parsed.data.notes, is_active: parsed.data.isActive }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo actualizar el usuario." };
  await audit({ actorId: auth.userId, companyId: current.company_id, action: "user.updated", entityType: "managed_user", entityId: id });
  revalidatePlatform();
  return { ok: true, id };
}

export async function archiveManagedUser(id: string): Promise<PlatformActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const { data: current, error: currentError } = await createAdminClient().from("managed_users").select("*, managed_companies(*)").eq("id", id).single();
  if (currentError || !current) return { ok: false, error: "Usuario no encontrado." };
  try { if (current.auth_user_id) await remoteClient(Array.isArray(current.managed_companies) ? current.managed_companies[0] : current.managed_companies).from("profiles").update({ is_active: false }).eq("id", current.auth_user_id); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "No se pudo desactivar la cuenta externa." }; }
  const { error } = await createAdminClient().from("managed_users").update({ is_active: false }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo desactivar el usuario." };
  await audit({ actorId: auth.userId, companyId: current.company_id, action: "user.deactivated", entityType: "managed_user", entityId: id });
  revalidatePlatform();
  return { ok: true, id };
}

export async function deleteManagedUser(id: string): Promise<PlatformActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const { data: current, error: currentError } = await createAdminClient().from("managed_users").select("*, managed_companies(*)").eq("id", id).single();
  if (currentError || !current) return { ok: false, error: "Usuario no encontrado." };
  const company = Array.isArray(current.managed_companies) ? current.managed_companies[0] : current.managed_companies;
  try {
    if (current.auth_user_id) {
      const result = await remoteClient(company).auth.admin.deleteUser(current.auth_user_id);
      if (result.error) return { ok: false, error: result.error.message };
    }
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "No se pudo eliminar la cuenta externa." }; }
  const { error } = await createAdminClient().from("managed_users").delete().eq("id", id);
  if (error) return { ok: false, error: "La cuenta externa fue eliminada, pero no se pudo borrar el registro central." };
  await audit({ actorId: auth.userId, companyId: current.company_id, action: "user.deleted", entityType: "managed_user", entityId: id });
  revalidatePlatform();
  return { ok: true, id };
}

export async function resetManagedUserPassword(id: string): Promise<PlatformActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const { data: current, error } = await createAdminClient().from("managed_users").select("*, managed_companies(*)").eq("id", id).single();
  if (error || !current?.auth_user_id) return { ok: false, error: "Usuario no encontrado o sin cuenta externa." };
  const company = Array.isArray(current.managed_companies) ? current.managed_companies[0] : current.managed_companies;
  const password = generatedPassword();
  try { const result = await remoteClient(company).auth.admin.updateUserById(current.auth_user_id, { password }); if (result.error) return { ok: false, error: result.error.message }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "No se pudo restablecer la contraseña." }; }
  await createAdminClient().from("managed_users").update({ last_password_reset_at: new Date().toISOString() }).eq("id", id);
  await audit({ actorId: auth.userId, companyId: current.company_id, action: "user.password_reset", entityType: "managed_user", entityId: id });
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
  if (process.env.PLATFORM_RUNNER_URL) {
    try { await fetch(`${process.env.PLATFORM_RUNNER_URL.replace(/\/$/, "")}/runs`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.PLATFORM_RUNNER_TOKEN ?? ""}` }, body: JSON.stringify({ runId: data.id, companyId: parsed.data.companyId, scriptKey: parsed.data.scriptKey }) }); } catch { /* queda en cola para reintento */ }
  }
  revalidatePlatform();
  return { ok: true, id: data.id, message: process.env.PLATFORM_RUNNER_URL ? "Tarea enviada al ejecutor." : "Tarea en cola: falta configurar PLATFORM_RUNNER_URL." };
}

export async function retryPlatformAutomation(id: string): Promise<PlatformActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const { data: run, error: readError } = await createAdminClient().from("platform_automation_runs").select("id, company_id, script_key, attempts, max_attempts").eq("id", id).single();
  if (readError || !run) return { ok: false, error: "Ejecución no encontrada." };
  if (run.attempts >= run.max_attempts) return { ok: false, error: "Se alcanzó el máximo de reintentos configurado." };
  const { error } = await createAdminClient().from("platform_automation_runs").update({ status: "queued", attempts: run.attempts + 1, error_message: "", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo reintentar la tarea." };
  await audit({ actorId: auth.userId, companyId: run.company_id, action: "automation.retried", entityType: "automation_run", entityId: id, metadata: { scriptKey: run.script_key, attempt: run.attempts + 1 } });
  revalidatePlatform();
  return { ok: true, id, message: "Tarea puesta nuevamente en cola." };
}
