import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getPropertiesAdmin() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("properties")
    .select("*, categories(name), locations(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getPropertyForEdit(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("properties")
    .select("*, locations(name), property_images(id, url, alt_text, sort_order)")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

// Categorías y ubicaciones se leen con las queries públicas de
// lib/queries.ts (getCategoriesPublic / getLocationsPublic): son datos de
// referencia de solo lectura, no necesitan la service role key.

export async function getInquiries(limit = 200) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("inquiries")
    .select("id, full_name, email, phone, subject, message, status, created_at, crm_conversation_id, properties(title, slug)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((inq) => ({ ...inq, name: inq.full_name }));
}

export async function getProfiles() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export type TeamMember = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: "admin" | "agente";
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  last_sign_in_at: string | null;
  contactCount: number;
  openTaskCount: number;
};

export type TeamRecommendation = {
  id: string;
  title: string;
  detail: string;
};

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: "admin" | "agente";
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
};

function countBy(
  rows: Array<{ assigned_to: string | null } | null> | null,
  id: string
) {
  return (rows ?? []).filter((row) => row?.assigned_to === id).length;
}

async function hydrateTeamMembers(
  profiles: ProfileRow[]
): Promise<TeamMember[]> {
  const supabase = createAdminClient();
  const [{ data: authUsers }, { data: contacts }, { data: tasks }] =
    await Promise.all([
      supabase.auth.admin.listUsers({ page: 1, perPage: 200 }),
      supabase.from("contacts").select("assigned_to"),
      supabase
        .from("tasks")
        .select("assigned_to")
        .eq("status", "pendiente"),
    ]);

  const lastSignIn = new Map(
    (authUsers?.users ?? []).map((user) => [
      user.id,
      user.last_sign_in_at ?? null,
    ])
  );

  return profiles.map((profile) => ({
    ...profile,
    last_sign_in_at: lastSignIn.get(profile.id) ?? null,
    contactCount: countBy(contacts, profile.id),
    openTaskCount: countBy(tasks, profile.id),
  }));
}

export async function getTeamDirectory(): Promise<TeamMember[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, phone, avatar_url, role, is_active, created_at, updated_at"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return hydrateTeamMembers((data ?? []) as ProfileRow[]);
}

export async function getTeamMember(id: string): Promise<TeamMember | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, phone, avatar_url, role, is_active, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [member] = await hydrateTeamMembers([data as ProfileRow]);
  return member ?? null;
}

export function getTeamRecommendations(
  members: TeamMember[],
  employeeEmail?: string
): TeamRecommendation[] {
  const recs: TeamRecommendation[] = [];
  const activeAdmins = members.filter(
    (member) => member.role === "admin" && member.is_active
  );
  if (activeAdmins.length < 2) {
    recs.push({
      id: "backup-admin",
      title: "Agregue un administrador de respaldo",
      detail:
        "Solo hay un admin activo. Si pierde el acceso, nadie más podrá gestionar el equipo ni la configuración.",
    });
  }

  const inactive = members.filter((member) => !member.is_active);
  if (inactive.length > 0) {
    recs.push({
      id: "inactive",
      title: "Revise cuentas inactivas",
      detail: `${inactive.length === 1 ? "Hay 1 miembro inactivo" : `Hay ${inactive.length} miembros inactivos`}. Confirme si deben reactivarse o permanecer sin acceso.`,
    });
  }

  const agentsMissingPhone = members.filter(
    (member) =>
      member.role === "agente" &&
      member.is_active &&
      !member.phone?.trim()
  );
  if (agentsMissingPhone.length > 0) {
    recs.push({
      id: "missing-phone",
      title: "Complete el teléfono de los agentes",
      detail:
        "El número facilita pases a WhatsApp y coordinación interna cuando un lead pide hablar con alguien del equipo.",
    });
  }

  const envEmployee = employeeEmail?.trim().toLowerCase();
  if (
    envEmployee &&
    !members.some((member) => member.email.trim().toLowerCase() === envEmployee)
  ) {
    recs.push({
      id: "env-employee",
      title: "Falta el perfil del empleado de entorno",
      detail: `Existe el acceso ${envEmployee} en variables de entorno, pero no aparece aquí. Créelo como miembro para que figure en el directorio y pueda entrar por Auth.`,
    });
  }

  const idleAgents = members.filter(
    (member) =>
      member.role === "agente" &&
      member.is_active &&
      member.contactCount === 0
  );
  if (idleAgents.length > 0) {
    recs.push({
      id: "unassigned-pipeline",
      title: "Asigne contactos del pipeline",
      detail:
        idleAgents.length === 1
          ? `${idleAgents[0].full_name} no tiene contactos asignados. Úselo en el CRM para repartir la carga.`
          : `${idleAgents.length} agentes activos no tienen contactos asignados. Repártalos desde el pipeline o la bandeja.`,
    });
  }

  return recs;
}

function average(prices: number[]): number | null {
  if (prices.length === 0) return null;
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

export async function getDashboardStats() {
  const supabase = createAdminClient();

  const [
    { count: totalProperties },
    { count: published },
    { count: drafts },
    { count: featured },
    { count: totalInquiries },
    { count: unreadInquiries },
    { count: totalCategories },
    { count: totalLocations },
    { data: recentInquiries },
    { data: salePrices },
  ] = await Promise.all([
    supabase.from("properties").select("id", { count: "exact", head: true }),
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("status", "publicada"),
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("status", "borrador"),
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("is_featured", true),
    supabase.from("inquiries").select("id", { count: "exact", head: true }),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("status", "nueva"),
    supabase.from("categories").select("id", { count: "exact", head: true }),
    supabase.from("locations").select("id", { count: "exact", head: true }),
    supabase
      .from("inquiries")
      .select("id, full_name, phone, email, status, created_at, properties(title)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("properties")
      .select("price, currency")
      .eq("status", "publicada")
      .eq("operation", "venta"),
  ]);

  // Promedio por moneda: mezclar monedas (o contar las no-USD como 0) daba
  // un promedio incorrecto. Solo ventas publicadas.
  const pricesUsd = (salePrices ?? [])
    .filter((p) => p.currency === "USD")
    .map((p) => Number(p.price));
  const pricesHnl = (salePrices ?? [])
    .filter((p) => p.currency === "HNL")
    .map((p) => Number(p.price));

  const recent = (recentInquiries ?? []).map((inq) => ({
    id: inq.id,
    name: inq.full_name,
    phone: inq.phone,
    email: inq.email,
    status: inq.status,
    created_at: inq.created_at,
    property_title: inq.properties?.[0]?.title ?? null,
  }));

  return {
    totalProperties: totalProperties ?? 0,
    published: published ?? 0,
    drafts: drafts ?? 0,
    featured: featured ?? 0,
    totalInquiries: totalInquiries ?? 0,
    unreadInquiries: unreadInquiries ?? 0,
    totalCategories: totalCategories ?? 0,
    totalLocations: totalLocations ?? 0,
    recentInquiries: recent,
    avgSalePriceUsd: average(pricesUsd),
    avgSalePriceHnl: average(pricesHnl),
  };
}
