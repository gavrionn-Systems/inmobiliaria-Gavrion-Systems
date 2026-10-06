"use client";

import { useMemo, useState } from "react";
import {
  archiveManagedCompany,
  archiveManagedUser,
  checkManagedCompanyHealth,
  createManagedCompany,
  createManagedUser,
  deleteManagedUser,
  queuePlatformAutomation,
  resetManagedUserPassword,
  retryPlatformAutomation,
  updateManagedCompany,
  updateManagedUser,
} from "@/lib/platform-actions";

type Company = {
  id: string;
  name: string;
  slug: string;
  public_url: string;
  deployment_url: string;
  supabase_url: string;
  supabase_anon_key: string;
  supabase_project_ref: string;
  vercel_project_name: string;
  template_version: string;
  target_template_version: string;
  health_status: string;
  status: "active" | "paused" | "archived";
  notes: string;
  created_at: string;
};

type ManagedUser = {
  id: string;
  company_id: string;
  full_name: string;
  email: string;
  role: "company_admin" | "designer" | "agente";
  is_active: boolean;
  notes: string;
  created_at: string;
};

type AutomationRun = {
  id: string;
  company_id: string;
  script_key: string;
  status: string;
  output: string;
  created_at: string;
};

type AuditEntry = { id: string; company_id: string | null; action: string; entity_type: string; entity_id: string; created_at: string; };
type Release = { id: string; version: string; git_ref: string; release_notes: string; is_available: boolean; created_at: string; };

type Props = {
  companies: Company[];
  users: ManagedUser[];
  runs: AutomationRun[];
  audit: AuditEntry[];
  releases: Release[];
};

const scripts = [
  ["apply_migrations", "Aplicar migraciones pendientes"],
  ["sync_site_settings", "Sincronizar configuración del sitio"],
  ["refresh_search_indexes", "Actualizar índices de búsqueda"],
] as const;

const roleLabels = {
  company_admin: "Administrador de empresa",
  designer: "Diseñador",
  agente: "Agente",
};

function resultMessage(result: { ok: boolean; error?: string }) {
  if (!result.ok) return result.error ?? "No se pudo completar la operación.";
  const typed = result as { ok: true; message?: string; temporaryPassword?: string };
  return typed.temporaryPassword
    ? `${typed.message ?? "Cuenta creada."} Contraseña temporal: ${typed.temporaryPassword}`
    : typed.message ?? "Cambios guardados correctamente.";
}

export default function PlatformControlPanel({ companies, users, runs, audit, releases }: Props) {
  const [section, setSection] = useState<"companies" | "users" | "automation" | "audit" | "releases">("companies");
  const [message, setMessage] = useState("");
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const activeCompanies = useMemo(() => companies.filter((company) => company.status !== "archived"), [companies]);

  async function saveCompany(formData: FormData) {
    const input = {
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      publicUrl: String(formData.get("publicUrl") ?? ""),
      deploymentUrl: String(formData.get("deploymentUrl") ?? ""),
      supabaseUrl: String(formData.get("supabaseUrl") ?? ""),
      supabaseAnonKey: String(formData.get("supabaseAnonKey") ?? ""),
      supabaseProjectRef: String(formData.get("supabaseProjectRef") ?? ""),
      supabaseServiceRoleKey: String(formData.get("supabaseServiceRoleKey") ?? ""),
      vercelProjectName: String(formData.get("vercelProjectName") ?? ""),
      templateVersion: String(formData.get("templateVersion") ?? "base"),
      targetTemplateVersion: String(formData.get("targetTemplateVersion") ?? "base"),
      notes: String(formData.get("notes") ?? ""),
      ...(editingCompany ? { status: String(formData.get("status") ?? "active") } : {}),
    };
    const result = editingCompany
      ? await updateManagedCompany(editingCompany.id, input)
      : await createManagedCompany(input);
    setMessage(resultMessage(result));
    if (result.ok) setEditingCompany(null);
  }

  async function saveUser(formData: FormData) {
    const input = {
      companyId: String(formData.get("companyId") ?? ""),
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      role: String(formData.get("role") ?? "agente"),
      temporaryPassword: String(formData.get("temporaryPassword") ?? "") || undefined,
      notes: String(formData.get("notes") ?? ""),
    };
    const result = editingUser
      ? await updateManagedUser(editingUser.id, { ...input, isActive: editingUser.is_active })
      : await createManagedUser(input);
    setMessage(resultMessage(result));
    if (result.ok) setEditingUser(null);
  }

  async function archiveCompany(id: string) {
    if (!window.confirm("La empresa quedará archivada y dejará de aparecer como activa. ¿Continuar?")) return;
    setMessage(resultMessage(await archiveManagedCompany(id)));
  }

  async function archiveUser(id: string) {
    if (!window.confirm("El usuario quedará desactivado. ¿Continuar?")) return;
    setMessage(resultMessage(await archiveManagedUser(id)));
  }

  async function resetUser(id: string) {
    setMessage(resultMessage(await resetManagedUserPassword(id)));
  }

  async function deleteUser(id: string) {
    if (!window.confirm("Esta acción elimina la cuenta de la empresa y su registro central. ¿Continuar?")) return;
    setMessage(resultMessage(await deleteManagedUser(id)));
  }

  async function checkHealth(id: string) {
    setMessage(resultMessage(await checkManagedCompanyHealth(id)));
  }

  async function runAutomation(formData: FormData) {
    const result = await queuePlatformAutomation({
      companyId: String(formData.get("companyId") ?? ""),
      scriptKey: String(formData.get("scriptKey") ?? ""),
    });
    setMessage(result.ok ? "Tarea puesta en cola. El ejecutor la procesará de forma segura." : result.error ?? "No se pudo poner la tarea en cola.");
  }

  async function retryAutomation(id: string) {
    setMessage(resultMessage(await retryPlatformAutomation(id)));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-outline-variant pb-2" role="tablist" aria-label="Panel general">
        {[
          ["companies", "Empresas", "business"],
          ["users", "Usuarios", "group"],
          ["automation", "Automatizaciones", "terminal"],
          ["audit", "Auditoría", "history"],
          ["releases", "Versiones", "deployed_code"],
        ].map(([key, label, icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={section === key}
            onClick={() => setSection(key as typeof section)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 font-label-md transition-colors ${section === key ? "bg-primary text-on-primary" : "text-secondary hover:bg-surface-container-high"}`}
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {message ? <p role="status" className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-secondary">{message}</p> : null}

      {section === "companies" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <section className="space-y-4">
            <div>
              <h2 className="font-headline-md text-on-surface">Empresas administradas</h2>
              <p className="text-sm text-secondary">Registre cada instalación independiente y su despliegue.</p>
            </div>
            {companies.length === 0 ? <Empty text="Todavía no hay empresas registradas." /> : companies.map((company) => (
              <article key={company.id} className="rounded-xl border border-outline-variant bg-surface-container-low p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-headline-sm text-on-surface">{company.name}</h3>
                    <p className="text-sm text-secondary">/{company.slug} · {company.supabase_project_ref || "Sin referencia Supabase"}</p>
                  </div>
                  <span className="rounded-full bg-primary-container px-3 py-1 text-xs font-semibold text-on-primary-container">{company.status} · {company.health_status}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  {company.public_url ? <a className="text-primary hover:underline" href={company.public_url} target="_blank" rel="noreferrer">Sitio público</a> : null}
                  {company.deployment_url ? <a className="text-primary hover:underline" href={company.deployment_url} target="_blank" rel="noreferrer">Vercel</a> : null}
                </div>
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => setEditingCompany(company)} className="rounded-lg border border-outline-variant px-3 py-2 text-sm text-secondary hover:bg-surface-container-high">Editar</button>
                  {company.status !== "archived" ? <button type="button" onClick={() => archiveCompany(company.id)} className="rounded-lg border border-error px-3 py-2 text-sm text-error hover:bg-error-container">Archivar</button> : null}
                  <button type="button" onClick={() => checkHealth(company.id)} className="rounded-lg border border-outline-variant px-3 py-2 text-sm text-secondary hover:bg-surface-container-high">Comprobar estado</button>
                </div>
              </article>
            ))}
          </section>
          <CompanyForm company={editingCompany} onSubmit={saveCompany} onCancel={() => setEditingCompany(null)} />
        </div>
      ) : null}

      {section === "users" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <section className="space-y-4">
            <div><h2 className="font-headline-md text-on-surface">Usuarios por empresa</h2><p className="text-sm text-secondary">Administre administradores, diseñadores y agentes de cada instalación.</p></div>
            {users.length === 0 ? <Empty text="Todavía no hay usuarios registrados." /> : users.map((user) => {
              const company = companies.find((item) => item.id === user.company_id);
              return <article key={user.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-5">
                <div><h3 className="font-label-md font-semibold text-on-surface">{user.full_name}</h3><p className="text-sm text-secondary">{user.email} · {company?.name ?? "Empresa eliminada"}</p><span className="mt-2 inline-flex rounded-full bg-surface-container-highest px-2.5 py-1 text-xs text-secondary">{roleLabels[user.role]} · {user.is_active ? "Activo" : "Inactivo"}</span></div>
                <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setEditingUser(user)} className="rounded-lg border border-outline-variant px-3 py-2 text-sm text-secondary hover:bg-surface-container-high">Editar</button><button type="button" onClick={() => resetUser(user.id)} className="rounded-lg border border-outline-variant px-3 py-2 text-sm text-secondary hover:bg-surface-container-high">Restablecer contraseña</button>{user.is_active ? <button type="button" onClick={() => archiveUser(user.id)} className="rounded-lg border border-error px-3 py-2 text-sm text-error hover:bg-error-container">Desactivar</button> : null}<button type="button" onClick={() => deleteUser(user.id)} className="rounded-lg border border-error px-3 py-2 text-sm text-error hover:bg-error-container">Eliminar</button></div>
              </article>;
            })}
          </section>
          <UserForm user={editingUser} companies={activeCompanies} onSubmit={saveUser} onCancel={() => setEditingUser(null)} />
        </div>
      ) : null}

      {section === "automation" ? (
        <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
          <AutomationForm companies={activeCompanies} onSubmit={runAutomation} />
          <section className="space-y-4"><div><h2 className="font-headline-md text-on-surface">Historial de ejecuciones</h2><p className="text-sm text-secondary">Cada tarea queda registrada por empresa y estado.</p></div>{runs.length === 0 ? <Empty text="No hay ejecuciones registradas." /> : runs.map((run) => <article key={run.id} className="rounded-xl border border-outline-variant bg-surface-container-low p-4"><div className="flex flex-wrap justify-between gap-2"><strong className="text-on-surface">{scripts.find(([key]) => key === run.script_key)?.[1] ?? run.script_key}</strong><span className="text-xs text-secondary">{run.status}</span></div><p className="mt-1 text-sm text-secondary">{companies.find((company) => company.id === run.company_id)?.name ?? "Empresa eliminada"} · {new Date(run.created_at).toLocaleString("es")}</p>{run.output ? <p className="mt-3 text-sm text-secondary">{run.output}</p> : null}{run.status === "failed" ? <button type="button" onClick={() => retryAutomation(run.id)} className="mt-3 rounded-lg border border-outline-variant px-3 py-2 text-sm text-secondary hover:bg-surface-container-high">Reintentar</button> : null}</article>)}</section>
        </div>
      ) : null}

      {section === "audit" ? <section className="space-y-4"><div><h2 className="font-headline-md text-on-surface">Auditoría del panel general</h2><p className="text-sm text-secondary">Registro de altas, cambios, accesos y automatizaciones.</p></div>{audit.length === 0 ? <Empty text="No hay eventos registrados." /> : audit.map((entry) => <article key={entry.id} className="rounded-xl border border-outline-variant bg-surface-container-low p-4"><div className="flex flex-wrap justify-between gap-2"><strong className="text-on-surface">{entry.action}</strong><span className="text-xs text-secondary">{new Date(entry.created_at).toLocaleString("es")}</span></div><p className="mt-1 text-sm text-secondary">{entry.entity_type} · {companies.find((company) => company.id === entry.company_id)?.name ?? "Panel general"}</p></article>)}</section> : null}

      {section === "releases" ? <section className="space-y-4"><div><h2 className="font-headline-md text-on-surface">Versiones de plantilla</h2><p className="text-sm text-secondary">Compare la versión instalada con la versión objetivo de cada empresa.</p></div>{releases.length === 0 ? <Empty text="No hay versiones publicadas." /> : releases.map((release) => <article key={release.id} className="rounded-xl border border-outline-variant bg-surface-container-low p-4"><div className="flex flex-wrap justify-between gap-2"><strong className="text-on-surface">Versión {release.version}</strong><span className="text-xs text-secondary">{release.git_ref}</span></div><p className="mt-1 text-sm text-secondary">{release.release_notes || "Sin notas de versión."}</p></article>)}</section> : null}
    </div>
  );
}

function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-outline-variant p-8 text-center text-sm text-secondary">{text}</div>; }

function CompanyForm({ company, onSubmit, onCancel }: { company: Company | null; onSubmit: (formData: FormData) => Promise<void>; onCancel: () => void }) {
  return <form action={onSubmit} className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-low p-5">
    <h2 className="font-headline-md text-on-surface">{company ? "Editar empresa" : "Nueva empresa"}</h2>
    <Field name="name" label="Nombre" defaultValue={company?.name} required />
    <Field name="slug" label="Identificador" defaultValue={company?.slug} required />
    <Field name="publicUrl" label="URL pública" type="url" defaultValue={company?.public_url} />
    <Field name="deploymentUrl" label="URL de Vercel" type="url" defaultValue={company?.deployment_url} />
    <Field name="supabaseUrl" label="URL de Supabase" type="url" defaultValue={company?.supabase_url} />
    <Field name="supabaseAnonKey" label="Anon key de Supabase" defaultValue={company?.supabase_anon_key} />
    <Field name="supabaseServiceRoleKey" label="Service role key (se cifra y no se muestra)" type="password" />
    <Field name="supabaseProjectRef" label="Referencia del proyecto Supabase" defaultValue={company?.supabase_project_ref} />
    <Field name="vercelProjectName" label="Proyecto de Vercel" defaultValue={company?.vercel_project_name} />
    <div className="grid grid-cols-2 gap-2"><Field name="templateVersion" label="Versión actual" defaultValue={company?.template_version ?? "base"} /><Field name="targetTemplateVersion" label="Versión objetivo" defaultValue={company?.target_template_version ?? "base"} /></div>
    <label className="block text-sm text-secondary">Notas<textarea name="notes" defaultValue={company?.notes} className="mt-1 min-h-20 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-on-surface" /></label>
    {company ? <label className="block text-sm text-secondary">Estado<select name="status" defaultValue={company.status} className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-on-surface"><option value="active">Activa</option><option value="paused">Pausada</option><option value="archived">Archivada</option></select></label> : null}
    <p className="text-xs text-secondary">La service role key se cifra en el servidor con PLATFORM_ENCRYPTION_KEY y nunca se devuelve al navegador.</p>
    <div className="flex gap-2"><button className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary" type="submit">Guardar empresa</button>{company ? <button className="rounded-lg border border-outline-variant px-4 py-2 text-secondary" type="button" onClick={onCancel}>Cancelar</button> : null}</div>
  </form>;
}

function UserForm({ user, companies, onSubmit, onCancel }: { user: ManagedUser | null; companies: Company[]; onSubmit: (formData: FormData) => Promise<void>; onCancel: () => void }) {
  return <form action={onSubmit} className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-low p-5">
    <h2 className="font-headline-md text-on-surface">{user ? "Editar usuario" : "Nueva cuenta"}</h2>
    <label className="block text-sm text-secondary">Empresa<select name="companyId" defaultValue={user?.company_id ?? companies[0]?.id ?? ""} disabled={Boolean(user)} required className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-on-surface"><option value="">Seleccione una empresa</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
    <Field name="fullName" label="Nombre completo" defaultValue={user?.full_name} required /><Field name="email" label="Correo" type="email" defaultValue={user?.email} required />
    {!user ? <Field name="temporaryPassword" label="Contraseña temporal (opcional)" type="password" /> : null}
    <label className="block text-sm text-secondary">Rol<select name="role" defaultValue={user?.role ?? "company_admin"} className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-on-surface"><option value="company_admin">Administrador de empresa</option><option value="designer">Diseñador</option><option value="agente">Agente</option></select></label>
    <label className="block text-sm text-secondary">Notas<textarea name="notes" defaultValue={user?.notes} className="mt-1 min-h-20 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-on-surface" /></label>
    <p className="text-xs text-secondary">La contraseña se muestra una sola vez después de crear o restablecer la cuenta.</p>
    <div className="flex gap-2"><button className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary" type="submit">Guardar usuario</button>{user ? <button className="rounded-lg border border-outline-variant px-4 py-2 text-secondary" type="button" onClick={onCancel}>Cancelar</button> : null}</div>
  </form>;
}

function AutomationForm({ companies, onSubmit }: { companies: Company[]; onSubmit: (formData: FormData) => Promise<void> }) { return <form action={onSubmit} className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-low p-5"><h2 className="font-headline-md text-on-surface">Ejecutar tarea</h2><p className="text-sm text-secondary">Las tareas se ponen en cola para un ejecutor seguro por empresa.</p><label className="block text-sm text-secondary">Empresa<select name="companyId" defaultValue={companies[0]?.id ?? ""} required className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-on-surface"><option value="">Seleccione una empresa</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label><label className="block text-sm text-secondary">Tarea<select name="scriptKey" defaultValue={scripts[0][0]} className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-on-surface">{scripts.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary" type="submit">Poner en cola</button></form>; }

function Field({ name, label, type = "text", defaultValue, required }: { name: string; label: string; type?: string; defaultValue?: string; required?: boolean }) { return <label className="block text-sm text-secondary">{label}<input name={name} type={type} defaultValue={defaultValue ?? ""} required={required} className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-on-surface" /></label>; }
