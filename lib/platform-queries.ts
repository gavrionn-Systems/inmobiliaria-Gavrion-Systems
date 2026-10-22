import "server-only";

import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptPlatformSecret } from "@/lib/platform-security";
import { isInternalUserEmail, usernameFromStoredEmail } from "@/lib/user-identifiers";

type ManagedCompany = {
  id: string;
  name: string;
  slug: string;
  public_url: string;
  deployment_url: string;
  vercel_project_name: string;
  supabase_url: string;
  supabase_service_role_key_encrypted: string;
};

type ManagedUser = {
  id: string;
  identity_id: string;
  company_id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  role: "company_admin" | "designer" | "agente";
  is_active: boolean;
  notes: string;
  created_at: string;
};

export type ManagedUserView = ManagedUser & {
  company_ids: string[];
  company_names: string[];
};

type RemoteProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: "admin" | "designer" | "agente" | string;
  is_active: boolean;
};

function centralRole(role: RemoteProfile["role"]): ManagedUser["role"] | null {
  if (role === "admin") return "company_admin";
  if (role === "designer") return "designer";
  if (role === "agente") return "agente";
  return null;
}

async function syncCompanyUsers(
  supabase: ReturnType<typeof createAdminClient>,
  companies: ManagedCompany[],
  users: ManagedUser[],
) {
  await Promise.all(companies.map(async (company) => {
    if (!company.supabase_url || !company.supabase_service_role_key_encrypted) return;

    try {
      const serviceKey = decryptPlatformSecret(company.supabase_service_role_key_encrypted);
      if (!serviceKey) return;
      const remote = createClient(company.supabase_url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: profiles, error } = await remote
        .from("profiles")
        .select("id, full_name, email, role, is_active")
        .in("role", ["admin", "designer", "agente"])
        .limit(1000);
      if (error) return;

      for (const profile of (profiles ?? []) as RemoteProfile[]) {
        const role = centralRole(profile.role);
        const email = profile.email?.trim().toLowerCase();
        if (!role || !email) continue;

        const current = users.find((user) =>
          user.company_id === company.id &&
          (user.auth_user_id === profile.id || user.email.trim().toLowerCase() === email)
        );
        const patch = {
          auth_user_id: profile.id,
          full_name: profile.full_name?.trim() || email,
          email,
          role,
          is_active: profile.is_active,
        };

        if (current) {
          await supabase.from("managed_users").update(patch).eq("id", current.id);
          Object.assign(current, patch);
          continue;
        }

        const { data: inserted, error: insertError } = await supabase
          .from("managed_users")
          .insert({ company_id: company.id, ...patch, notes: "" })
          .select("id, identity_id, company_id, auth_user_id, full_name, email, role, is_active, notes")
          .maybeSingle();
        if (!insertError && inserted) users.push(inserted as ManagedUser);
      }
    } catch {
      // Una empresa sin clave válida no debe impedir que se muestre el resto.
    }
  }));
}

/**
 * Propaga al usuario remoto la lista de sitios que tiene asignados.
 * Se hace desde el panel general para que también se actualicen diseñadores
 * creados antes de que existiera el selector multiempresa.
 */
async function syncDesignerAssignments(
  companies: ManagedCompany[],
  users: ManagedUser[],
) {
  const companyById = new Map(companies.map((company) => [company.id, company]));
  const groups = new Map<string, ManagedUser[]>();
  for (const user of users) {
    const identityId = user.identity_id ?? user.id;
    const group = groups.get(identityId) ?? [];
    group.push(user);
    groups.set(identityId, group);
  }

  await Promise.all([...groups.values()].map(async (rows) => {
    if (rows[0]?.role !== "designer") return;
    const activeRows = rows.filter((row) => row.is_active);
    const assignedCompanies = activeRows
      .map((row) => companyById.get(row.company_id))
      .filter((company): company is ManagedCompany => Boolean(company))
      .map((company) => ({
        id: company.id,
        name: company.name,
        publicUrl: company.public_url?.trim() || "",
        deploymentUrl: company.deployment_url?.trim() || (company.vercel_project_name?.trim() ? `https://${company.vercel_project_name.trim().toLowerCase()}.vercel.app` : ""),
        url: company.public_url?.trim() || company.deployment_url?.trim() || (company.vercel_project_name?.trim() ? `https://${company.vercel_project_name.trim().toLowerCase()}.vercel.app` : ""),
        adminPath: company.slug?.trim() || "",
      }));

    await Promise.all(activeRows.map(async (row) => {
      const company = companyById.get(row.company_id);
      if (!company?.supabase_url || !company.supabase_service_role_key_encrypted || !row.auth_user_id) return;
      try {
        const serviceKey = decryptPlatformSecret(company.supabase_service_role_key_encrypted);
        if (!serviceKey) return;
        const remote = createClient(company.supabase_url, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        await remote.auth.admin.updateUserById(row.auth_user_id, {
          user_metadata: {
            full_name: row.full_name,
            username: isInternalUserEmail(row.email) ? usernameFromStoredEmail(row.email) : row.email.split("@")[0],
            assigned_companies: assignedCompanies,
          },
        });
      } catch {
        // Una instalación no disponible no debe ocultar las demás.
      }
    }));
  }));
}

export async function getPlatformOverview() {
  const supabase = createAdminClient();
  const [companies, users, runs, audit, releases] = await Promise.all([
    supabase.from("managed_companies").select("*").order("created_at", { ascending: false }),
    supabase.from("managed_users").select("*").order("created_at", { ascending: false }),
    supabase.from("platform_automation_runs").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("platform_audit_log").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("platform_template_releases").select("*").order("created_at", { ascending: false }),
  ]);
  if (companies.error) throw companies.error;
  if (users.error) throw users.error;
  if (runs.error) throw runs.error;
  if (audit.error) throw audit.error;
  if (releases.error) throw releases.error;

  const managedCompanies = (companies.data ?? []) as ManagedCompany[];
  const managedUsers = (users.data ?? []) as ManagedUser[];
  await syncCompanyUsers(supabase, managedCompanies, managedUsers);
  const refreshedUsers = await supabase
    .from("managed_users")
    .select("*")
    .order("created_at", { ascending: false });
  if (refreshedUsers.error) throw refreshedUsers.error;

  const companyNames = new Map((companies.data ?? []).map((company) => [company.id, company.name]));
  const groupedUsers = new Map<string, ManagedUserView>();
  for (const row of (refreshedUsers.data ?? []) as ManagedUser[]) {
    const identityId = row.identity_id ?? row.id;
    const current = groupedUsers.get(identityId);
    if (current) {
      current.company_ids.push(row.company_id);
      current.company_names.push(companyNames.get(row.company_id) ?? "Empresa eliminada");
      current.is_active = current.is_active || row.is_active;
      continue;
    }
    groupedUsers.set(identityId, {
      ...row,
      identity_id: identityId,
      company_ids: [row.company_id],
      company_names: [companyNames.get(row.company_id) ?? "Empresa eliminada"],
    });
  }

  await syncDesignerAssignments(
    managedCompanies,
    (refreshedUsers.data ?? []) as ManagedUser[],
  );

  return {
    companies: companies.data ?? [],
    users: [...groupedUsers.values()],
    runs: runs.data ?? [],
    audit: audit.data ?? [],
    releases: releases.data ?? [],
  };
}
