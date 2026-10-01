-- Bucket para las fotos de propiedades subidas desde el panel.
-- Público en lectura: las URLs se sirven directamente a next/image.

-- Fallback: las políticas de escritura usan is_staff(). Si el esquema RBAC
-- aún no se aplicó, definimos un helper compatible con public.profiles.
create or replace function public.is_staff()
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
      and role in ('admin', 'agente')
  );
$$;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-images',
  'property-images',
  true,
  5242880,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Publico ve archivos de propiedades" on storage.objects;
drop policy if exists "Equipo sube archivos de propiedades" on storage.objects;
drop policy if exists "Equipo edita archivos de propiedades" on storage.objects;
drop policy if exists "Equipo elimina archivos de propiedades" on storage.objects;

create policy "Publico ve archivos de propiedades"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'property-images');

create policy "Equipo sube archivos de propiedades"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'property-images' and public.is_staff());

create policy "Equipo edita archivos de propiedades"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'property-images' and public.is_staff())
  with check (bucket_id = 'property-images' and public.is_staff());

create policy "Equipo elimina archivos de propiedades"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'property-images' and public.is_staff());
