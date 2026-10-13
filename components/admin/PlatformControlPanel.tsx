"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  archiveManagedCompany,
  archiveManagedUser,
  checkManagedCompanyHealth,
  createManagedCompany,
  createManagedUser,
  deleteManagedUser,
  getManagedCompanyChatbox,
  queuePlatformAutomation,
  resetManagedUserPassword,
  retryPlatformAutomation,
  saveManagedCompanyChatbox,
  updateManagedCompany,
  updateManagedUser,
} from "@/lib/platform-actions";
import type { ManagedChatboxSettings } from "@/lib/platform-actions";
import { isInternalUserEmail, usernameFromStoredEmail } from "@/lib/user-identifiers";

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
  const router = useRouter();
  const [section, setSection] = useState<"companies" | "users" | "chatbox" | "automation" | "audit" | "releases">("companies");
  const [message, setMessage] = useState("");
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [formRevision, setFormRevision] = useState(0);
  const activeCompanies = useMemo(() => companies.filter((company) => company.status !== "archived"), [companies]);
  const [chatboxCompanyId, setChatboxCompanyId] = useState(activeCompanies[0]?.id ?? "");
  const [chatboxSettings, setChatboxSettings] = useState<ManagedChatboxSettings | null>(null);
  const [chatboxLoading, setChatboxLoading] = useState(false);
  const [showChatboxTutorial, setShowChatboxTutorial] = useState(false);

  useEffect(() => {
    if (section !== "chatbox" || !chatboxCompanyId) return;
    let cancelled = false;
    setChatboxLoading(true);
    void getManagedCompanyChatbox(chatboxCompanyId).then((result) => {
      if (cancelled) return;
      if (result.ok) setChatboxSettings(result.settings);
      else {
        setChatboxSettings(null);
        setMessage(result.error);
      }
      setChatboxLoading(false);
    });
    return () => { cancelled = true; };
  }, [section, chatboxCompanyId]);

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
    if (result.ok) {
      setEditingCompany(null);
      setFormRevision((value) => value + 1);
      router.refresh();
    }
  }

  async function saveUser(formData: FormData) {
    const input = {
      companyId: String(formData.get("companyId") ?? ""),
      fullName: String(formData.get("fullName") ?? ""),
      username: String(formData.get("username") ?? ""),
      role: String(formData.get("role") ?? "agente"),
      temporaryPassword: String(formData.get("temporaryPassword") ?? "") || undefined,
      notes: String(formData.get("notes") ?? ""),
    };
    const result = editingUser
      ? await updateManagedUser(editingUser.id, { ...input, isActive: editingUser.is_active })
      : await createManagedUser(input);
    setMessage(resultMessage(result));
    if (result.ok) {
      setEditingUser(null);
      setFormRevision((value) => value + 1);
      router.refresh();
    }
  }

  async function archiveCompany(id: string) {
    if (!window.confirm("La empresa quedará archivada y dejará de aparecer como activa. ¿Continuar?")) return;
    const result = await archiveManagedCompany(id);
    setMessage(resultMessage(result));
    if (result.ok) router.refresh();
  }

  async function archiveUser(id: string) {
    if (!window.confirm("El usuario quedará desactivado. ¿Continuar?")) return;
    const result = await archiveManagedUser(id);
    setMessage(resultMessage(result));
    if (result.ok) router.refresh();
  }

  async function resetUser(id: string) {
    const result = await resetManagedUserPassword(id);
    setMessage(resultMessage(result));
    if (result.ok) router.refresh();
  }

  async function deleteUser(id: string) {
    if (!window.confirm("Esta acción elimina la cuenta de la empresa y su registro central. ¿Continuar?")) return;
    const result = await deleteManagedUser(id);
    setMessage(resultMessage(result));
    if (result.ok) router.refresh();
  }

  async function checkHealth(id: string) {
    const result = await checkManagedCompanyHealth(id);
    setMessage(resultMessage(result));
    if (result.ok) router.refresh();
  }

  async function runAutomation(formData: FormData) {
    const result = await queuePlatformAutomation({
      companyId: String(formData.get("companyId") ?? ""),
      scriptKey: String(formData.get("scriptKey") ?? ""),
    });
    setMessage(resultMessage(result));
    if (result.ok) router.refresh();
  }

  async function retryAutomation(id: string) {
    const result = await retryPlatformAutomation(id);
    setMessage(resultMessage(result));
    if (result.ok) router.refresh();
  }

  async function saveChatbox(formData: FormData) {
    if (!chatboxCompanyId) return;
    const result = await saveManagedCompanyChatbox(chatboxCompanyId, {
      enabled: formData.has("enabled"),
      welcome: String(formData.get("welcome") ?? ""),
      statusMessage: String(formData.get("statusMessage") ?? ""),
      offlineMessage: String(formData.get("offlineMessage") ?? ""),
      position: String(formData.get("position") ?? "right"),
      launcher: String(formData.get("launcher") ?? ""),
      assistantEnabled: formData.has("assistantEnabled"),
      assistantName: String(formData.get("assistantName") ?? ""),
      assistantInstructions: String(formData.get("assistantInstructions") ?? ""),
      handoffMessage: String(formData.get("handoffMessage") ?? ""),
      knowledge: String(formData.get("knowledge") ?? ""),
    });
    setMessage(resultMessage(result));
    if (result.ok) router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-outline-variant pb-2" role="tablist" aria-label="Panel general">
        {[
          ["companies", "Empresas", "business"],
          ["users", "Usuarios", "group"],
          ["chatbox", "Chatbox", "chat"],
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
          <CompanyForm key={`${editingCompany?.id ?? "new-company"}-${formRevision}`} company={editingCompany} onSubmit={saveCompany} onCancel={() => setEditingCompany(null)} />
        </div>
      ) : null}

      {section === "users" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <section className="space-y-4">
            <div><h2 className="font-headline-md text-on-surface">Usuarios por empresa</h2><p className="text-sm text-secondary">Administre administradores, diseñadores y agentes de cada instalación.</p></div>
            {users.length === 0 ? <Empty text="Todavía no hay usuarios registrados." /> : users.map((user) => {
              const company = companies.find((item) => item.id === user.company_id);
              return <article key={user.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-5">
                <div><h3 className="font-label-md font-semibold text-on-surface">{user.full_name}</h3><p className="text-sm text-secondary">Usuario: {isInternalUserEmail(user.email) ? usernameFromStoredEmail(user.email) : user.email} · {company?.name ?? "Empresa eliminada"}</p><span className="mt-2 inline-flex rounded-full bg-surface-container-highest px-2.5 py-1 text-xs text-secondary">{roleLabels[user.role]} · {user.is_active ? "Activo" : "Inactivo"}</span></div>
                <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setEditingUser(user)} className="rounded-lg border border-outline-variant px-3 py-2 text-sm text-secondary hover:bg-surface-container-high">Editar</button><button type="button" onClick={() => resetUser(user.id)} className="rounded-lg border border-outline-variant px-3 py-2 text-sm text-secondary hover:bg-surface-container-high">Restablecer contraseña</button>{user.is_active ? <button type="button" onClick={() => archiveUser(user.id)} className="rounded-lg border border-error px-3 py-2 text-sm text-error hover:bg-error-container">Desactivar</button> : null}<button type="button" onClick={() => deleteUser(user.id)} className="rounded-lg border border-error px-3 py-2 text-sm text-error hover:bg-error-container">Eliminar</button></div>
              </article>;
            })}
          </section>
          <UserForm key={`${editingUser?.id ?? "new-user"}-${formRevision}`} user={editingUser} companies={activeCompanies} onSubmit={saveUser} onCancel={() => setEditingUser(null)} />
        </div>
      ) : null}

      {section === "chatbox" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <section className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
              <h2 className="font-headline-md text-on-surface">Chatbox por empresa</h2>
              <p className="text-sm text-secondary">Configure el widget y el asistente de cada base remota. Las claves de servicio nunca se envían al navegador.</p>
              </div>
              <button type="button" onClick={() => setShowChatboxTutorial((value) => !value)} className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary hover:bg-primary-container">
                <span className="material-symbols-outlined text-base" aria-hidden="true">school</span>
                {showChatboxTutorial ? "Ocultar tutorial" : "Tutorial"}
              </button>
            </div>
            {showChatboxTutorial ? <ChatboxTutorial /> : null}
            {chatboxLoading ? <div className="rounded-xl border border-outline-variant bg-surface-container-low p-6 text-sm text-secondary">Cargando configuración remota…</div> : chatboxSettings ? <ChatboxForm settings={chatboxSettings} company={activeCompanies.find((item) => item.id === chatboxCompanyId)} onSubmit={saveChatbox} /> : <Empty text="Seleccione una empresa conectada para configurar su chatbox." />}
          </section>
          <aside className="h-fit rounded-xl border border-outline-variant bg-surface-container-low p-5">
            <h3 className="font-headline-sm text-on-surface">Empresa</h3>
            <select value={chatboxCompanyId} onChange={(event) => setChatboxCompanyId(event.target.value)} className="mt-3 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-on-surface">
              <option value="">Seleccione una empresa</option>
              {activeCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
            <p className="mt-4 text-xs text-secondary">La configuración se guarda directamente en la base de datos de la empresa seleccionada.</p>
          </aside>
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

function ChatboxTutorial() {
  return <section className="rounded-xl border border-primary/30 bg-primary-container/20 p-5 text-sm text-on-surface">
    <div className="flex items-start gap-3">
      <span className="material-symbols-outlined mt-0.5 text-primary" aria-hidden="true">menu_book</span>
      <div className="min-w-0 flex-1">
        <h3 className="font-headline-sm text-on-surface">Tutorial: configurar el chatbox de una empresa</h3>
        <p className="mt-1 text-secondary">Realice estos pasos en orden. La configuración se guarda en la base independiente de la empresa seleccionada.</p>
        <ol className="mt-5 space-y-5">
          <li>
            <h4 className="font-semibold text-on-surface">1. Registrar la empresa en “Empresas”</h4>
            <p className="mt-1 text-secondary">Abra la pestaña <strong>Empresas</strong> y cree o edite la instalación. Complete el nombre, la URL pública, la URL de Vercel y la URL del proyecto Supabase.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-secondary">
              <li><strong>Anon key:</strong> use la clave pública del proyecto Supabase.</li>
              <li><strong>Referencia del proyecto:</strong> el identificador que aparece en la URL del proyecto.</li>
              <li><strong>Service role key:</strong> copie la clave secreta del proyecto Supabase. Se cifra en el servidor y no se muestra al navegador.</li>
            </ul>
            <p className="mt-2 rounded-lg bg-surface-container-low px-3 py-2 text-xs text-secondary">Nunca coloque la service role key en el widget, en el navegador, en GitHub ni en una variable <code>NEXT_PUBLIC_*</code>.</p>
          </li>
          <li>
            <h4 className="font-semibold text-on-surface">2. Aplicar la migración en la base de la empresa</h4>
            <p className="mt-1 text-secondary">Entre al proyecto Supabase de esa empresa, abra <strong>SQL Editor</strong> y ejecute el contenido de <code>supabase/migrations/20261013100000_chatbox.sql</code>. También puede hacerlo desde la terminal:</p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-surface p-3 text-xs text-on-surface">{`cd apps/web\nnpx supabase link --project-ref REFERENCIA_DE_LA_EMPRESA\nnpx supabase db push`}</pre>
            <p className="mt-2 text-secondary">La migración crea <code>chatbox_settings</code>, el identificador del visitante web y deja listas las tablas para guardar conversaciones y mensajes.</p>
          </li>
          <li>
            <h4 className="font-semibold text-on-surface">3. Configurar la seguridad central en Vercel</h4>
            <p className="mt-1 text-secondary">En el proyecto central de Vercel vaya a <strong>Settings → Environment Variables</strong> y agregue:</p>
            <div className="mt-2 overflow-x-auto rounded-lg bg-surface p-3 font-mono text-xs text-on-surface">PLATFORM_ENCRYPTION_KEY</div>
            <p className="mt-2 text-secondary">Use una cadena aleatoria larga. Debe permanecer estable; si la cambia, el panel ya no podrá descifrar las service role keys guardadas anteriormente. Seleccione <strong>Production</strong> y vuelva a desplegar.</p>
          </li>
          <li>
            <h4 className="font-semibold text-on-surface">4. Entrar al panel general</h4>
            <p className="mt-1 text-secondary">Inicie sesión con el usuario de administrador general y abra <strong>Panel general → Chatbox</strong>. Este acceso usa el valor configurado en <code>ADMIN_PANEL_PATH</code>; no comparta la ruta públicamente.</p>
          </li>
          <li>
            <h4 className="font-semibold text-on-surface">5. Seleccionar y configurar la empresa</h4>
            <p className="mt-1 text-secondary">En el selector de la derecha elija la empresa. Espere a que cargue la configuración remota y complete los mensajes, la posición, el nombre de la IA, las instrucciones, el conocimiento empresarial y el mensaje de transferencia. El color se toma de la paleta del sitio. Presione <strong>Guardar chatbox de la empresa</strong>.</p>
            <p className="mt-2 text-secondary">Si aparece “Aplique primero la migración de chatbox”, vuelva al paso 2 o revise que la URL y las claves de Supabase correspondan a esa empresa.</p>
          </li>
          <li>
            <h4 className="font-semibold text-on-surface">6. Activar respuestas automáticas (opcional)</h4>
            <p className="mt-1 text-secondary">Para que responda la IA, agregue <code>GEMINI_API_KEY</code> o <code>OPENAI_API_KEY</code> en el Vercel de la empresa y vuelva a desplegar. Si no agrega estas variables, el mensaje sí se guardará en el CRM y quedará para atención humana.</p>
          </li>
          <li>
            <h4 className="font-semibold text-on-surface">7. Validar la instalación</h4>
            <p className="mt-1 text-secondary">Abra el sitio público de la empresa, use el botón del chat y envíe un mensaje. Después confirme que el contacto aparece en <strong>Solicitudes</strong> o <strong>CRM → Inbox</strong>. Desde allí el administrador puede presionar <strong>Tomar conversación</strong>, responder y luego <strong>Reactivar IA</strong>.</p>
          </li>
        </ol>
      </div>
    </div>
  </section>;
}

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
  <p className="text-xs text-secondary">La service role key es opcional al editar datos normales. Si la ingresas, se cifra únicamente en el servidor con PLATFORM_ENCRYPTION_KEY (o AUTH_SECRET mientras completas esa variable) y nunca se devuelve al navegador.</p>
    <div className="flex gap-2"><button className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary" type="submit">Guardar empresa</button>{company ? <button className="rounded-lg border border-outline-variant px-4 py-2 text-secondary" type="button" onClick={onCancel}>Cancelar</button> : null}</div>
  </form>;
}

function UserForm({ user, companies, onSubmit, onCancel }: { user: ManagedUser | null; companies: Company[]; onSubmit: (formData: FormData) => Promise<void>; onCancel: () => void }) {
  return <form action={onSubmit} className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-low p-5">
    <h2 className="font-headline-md text-on-surface">{user ? "Editar usuario" : "Nueva cuenta"}</h2>
    <label className="block text-sm text-secondary">Empresa<select name="companyId" defaultValue={user?.company_id ?? companies[0]?.id ?? ""} disabled={Boolean(user)} required className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-on-surface"><option value="">Seleccione una empresa</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
    <Field name="fullName" label="Nombre completo" defaultValue={user?.full_name} required /><Field name="username" label="Usuario" defaultValue={user ? (isInternalUserEmail(user.email) ? usernameFromStoredEmail(user.email) : user.email.split("@")[0]) : ""} required />
    {!user ? <>
      <Field name="temporaryPassword" label="Contraseña temporal (opcional)" type="password" />
      <p className="-mt-2 text-xs text-secondary">Puede dejarla vacía: se generará una contraseña segura y se mostrará una sola vez al crear la cuenta. El usuario siempre necesitará una contraseña para iniciar sesión.</p>
    </> : null}
    <label className="block text-sm text-secondary">Rol<select name="role" defaultValue={user?.role ?? "company_admin"} className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-on-surface"><option value="company_admin">Administrador de empresa</option><option value="designer">Diseñador</option><option value="agente">Agente</option></select></label>
    <label className="block text-sm text-secondary">Notas<textarea name="notes" defaultValue={user?.notes} className="mt-1 min-h-20 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-on-surface" /></label>
    <p className="text-xs text-secondary">No se necesita correo electrónico. El usuario iniciará sesión con este nombre de usuario y la contraseña. La contraseña se muestra una sola vez después de crear o restablecer la cuenta.</p>
    <div className="flex gap-2"><button className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary" type="submit">Guardar usuario</button>{user ? <button className="rounded-lg border border-outline-variant px-4 py-2 text-secondary" type="button" onClick={onCancel}>Cancelar</button> : null}</div>
  </form>;
}

function ChatboxForm({ settings, company, onSubmit }: { settings: ManagedChatboxSettings; company?: Company; onSubmit: (formData: FormData) => Promise<void> }) {
  const baseUrl = (company?.public_url || company?.deployment_url || "").replace(/\/$/, "");
  const snippet = settings.widget_key && baseUrl
    ? `<script src="${baseUrl}/widget.js" data-key="${settings.widget_key}" defer></script>`
    : "Guarde la conexión de la empresa y aplique la migración para generar el código.";
  return <form action={onSubmit} className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-low p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-headline-md text-on-surface">Configuración remota</h2><p className="text-sm text-secondary">{company?.name ?? "Empresa"}</p></div><label className="inline-flex items-center gap-2 text-sm text-secondary"><input type="checkbox" name="enabled" defaultChecked={settings.enabled} className="h-4 w-4 accent-[var(--color-primary)]" /> Chat visible</label></div>
    <div className="grid gap-4 md:grid-cols-2">
      <Field name="welcome" label="Mensaje de bienvenida" defaultValue={settings.welcome} required />
      <Field name="statusMessage" label="Mensaje de disponibilidad" defaultValue={settings.status_message} required />
      <Field name="offlineMessage" label="Mensaje fuera de horario" defaultValue={settings.offline_message} required />
      <div className="rounded-lg border border-outline-variant bg-surface p-3">
        <p className="text-sm text-secondary">Paleta del sitio</p>
        <p className="mt-1 text-xs text-secondary">El chatbox usa automáticamente el color principal configurado en el sitio.</p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[
            ["Principal", settings.palette.primaryColor],
            ["Acento", settings.palette.accentColor],
            ["Panel", settings.palette.adminColor],
            ["Fondo", settings.palette.backgroundColor],
          ].map(([label, color]) => (
            <div key={label} className="space-y-1 text-center">
              <div className="h-8 rounded border border-outline-variant" style={{ backgroundColor: color }} aria-label={`${label}: color configurado`} />
              <span className="block truncate text-[11px] text-secondary">{label}</span>
            </div>
          ))}
        </div>
      </div>
      <label className="block text-sm text-secondary">Posición<select name="position" defaultValue={settings.position} className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-on-surface"><option value="right">Derecha</option><option value="left">Izquierda</option></select></label>
      <Field name="launcher" label="Icono del botón" defaultValue={settings.launcher} required />
    </div>
    <div className="border-t border-outline-variant pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-headline-sm text-on-surface">Asistente IA</h3><p className="text-sm text-secondary">Configure el comportamiento inicial de la empresa.</p></div><label className="inline-flex items-center gap-2 text-sm text-secondary"><input type="checkbox" name="assistantEnabled" defaultChecked={settings.assistant_enabled} className="h-4 w-4 accent-[var(--color-primary)]" /> Respuestas automáticas</label></div><div className="mt-4 grid gap-4 md:grid-cols-2"><Field name="assistantName" label="Nombre del asistente" defaultValue={settings.assistant_name} required /><Field name="handoffMessage" label="Mensaje de transferencia" defaultValue={settings.handoff_message} required /><label className="block text-sm text-secondary">Instrucciones de tono<textarea name="assistantInstructions" defaultValue={settings.assistant_instructions} rows={4} className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-on-surface" /></label><label className="block text-sm text-secondary">Información confirmada<textarea name="knowledge" defaultValue={settings.knowledge} rows={4} placeholder="Horarios, ubicación, servicios y políticas." className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-on-surface" /></label></div></div>
    <div className="border-t border-outline-variant pt-5"><h3 className="font-headline-sm text-on-surface">Código de instalación</h3><pre className="mt-2 overflow-x-auto rounded bg-surface p-3 text-xs text-on-surface">{snippet}</pre></div>
    <button type="submit" className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary">Guardar chatbox de la empresa</button>
  </form>;
}

function AutomationForm({ companies, onSubmit }: { companies: Company[]; onSubmit: (formData: FormData) => Promise<void> }) { return <form action={onSubmit} className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-low p-5"><h2 className="font-headline-md text-on-surface">Ejecutar tarea</h2><p className="text-sm text-secondary">Las tareas se ponen en cola para un ejecutor seguro por empresa.</p><label className="block text-sm text-secondary">Empresa<select name="companyId" defaultValue={companies[0]?.id ?? ""} required className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-on-surface"><option value="">Seleccione una empresa</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label><label className="block text-sm text-secondary">Tarea<select name="scriptKey" defaultValue={scripts[0][0]} className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-on-surface">{scripts.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary" type="submit">Poner en cola</button></form>; }

function Field({ name, label, type = "text", defaultValue, required }: { name: string; label: string; type?: string; defaultValue?: string; required?: boolean }) { return <label className="block text-sm text-secondary">{label}<input name={name} type={type} defaultValue={defaultValue ?? ""} required={required} className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-on-surface" /></label>; }
