import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

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
  return {
    companies: companies.data ?? [],
    users: users.data ?? [],
    runs: runs.data ?? [],
    audit: audit.data ?? [],
    releases: releases.data ?? [],
  };
}
