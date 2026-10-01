-- Endurecimiento RBAC: alinear RLS con matriz Admin vs Empleado
-- Aplica is_staff() / is_admin() donde antes había using(true) para authenticated

-- ============================================================
-- Categories: lectura pública, escritura solo staff (realmente admin vía app, pero RLS deja staff)
-- ============================================================
drop policy if exists "Solo autenticados crean categorías" on public.categories;
create policy "Solo staff gestiona categorías - insert"
  on public.categories for insert to authenticated with check (public.is_staff());
create policy "Solo staff gestiona categorías - update"
  on public.categories for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Solo staff gestiona categorías - delete"
  on public.categories for delete to authenticated using (public.is_staff());

-- ============================================================
-- Locations: idem
-- ============================================================
drop policy if exists "Solo autenticados crean ubicaciones" on public.locations;
create policy "Solo staff gestiona ubicaciones - insert"
  on public.locations for insert to authenticated with check (public.is_staff());
create policy "Solo staff gestiona ubicaciones - update"
  on public.locations for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Solo staff gestiona ubicaciones - delete"
  on public.locations for delete to authenticated using (public.is_staff());

-- ============================================================
-- Properties: lectura staff para borradores, escritura staff
-- ============================================================
drop policy if exists "Propiedades publicadas de lectura pública" on public.properties;
create policy "Propiedades lectura pública o staff"
  on public.properties for select to anon, authenticated
  using (status = 'publicada' or public.is_staff());

drop policy if exists "Autenticados pueden crear propiedades" on public.properties;
create policy "Staff puede crear propiedades"
  on public.properties for insert to authenticated with check (public.is_staff());

drop policy if exists "Autenticados pueden editar propiedades" on public.properties;
create policy "Staff puede editar propiedades"
  on public.properties for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Autenticados pueden eliminar propiedades" on public.properties;
create policy "Staff puede eliminar propiedades"
  on public.properties for delete to authenticated using (public.is_staff());

-- ============================================================
-- Property_images: lectura pública, escritura staff
-- ============================================================
drop policy if exists "Autenticados pueden gestionar imágenes" on public.property_images;
create policy "Staff puede gestionar imágenes"
  on public.property_images for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ============================================================
-- Inquiries: lectura/actualización solo staff (anon solo insert ya existe)
-- ============================================================
drop policy if exists "Solo autenticados leen solicitudes" on public.inquiries;
create policy "Solo staff lee solicitudes"
  on public.inquiries for select to authenticated using (public.is_staff());

drop policy if exists "Autenticados actualizan solicitudes" on public.inquiries;
create policy "Solo staff actualiza solicitudes"
  on public.inquiries for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- Nota: "Público puede crear solicitudes" se mantiene (anon insert) definida en 20260817000000_init.sql
-- Si fue reemplazada en hardening, no se toca aquí.

-- ============================================================
-- Appointments: mantener anon insert, restringir select/update a staff
-- ============================================================
drop policy if exists "Authenticated can read appointments" on public.appointments;
create policy "Staff puede leer citas"
  on public.appointments for select to authenticated using (public.is_staff());

drop policy if exists "Authenticated can update appointments" on public.appointments;
create policy "Staff puede actualizar citas"
  on public.appointments for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- ============================================================
-- Site_schedule: lectura pública, update solo admin
-- ============================================================
drop policy if exists "Authenticated can update schedule" on public.site_schedule;
create policy "Solo admin actualiza horario"
  on public.site_schedule for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Audit: asegurar que audit_log permita service_role (ya implícito) y que is_staff pueda insertar
-- No se modifica; lib/audit.ts usa service_role
-- ============================================================
