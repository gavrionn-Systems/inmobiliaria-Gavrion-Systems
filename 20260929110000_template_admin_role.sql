-- Separa al administrador que configura la plantilla del administrador operativo
-- de la inmobiliaria. Cada instalación sigue teniendo una sola empresa/base.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('template_admin', 'admin', 'agente'));

create or replace function public.is_template_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active
      and role = 'template_admin'
  );
$$;

revoke all on function public.is_template_admin() from public;
grant execute on function public.is_template_admin() to authenticated;

drop policy if exists "site_settings_admin_insert" on public.site_settings;
create policy "site_settings_platform_insert"
  on public.site_settings
  for insert
  to authenticated
  with check (public.is_admin() or public.is_template_admin());

drop policy if exists "site_settings_admin_update" on public.site_settings;
create policy "site_settings_platform_update"
  on public.site_settings
  for update
  to authenticated
  using (public.is_admin() or public.is_template_admin())
  with check (public.is_admin() or public.is_template_admin());
