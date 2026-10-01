-- Esquema Supabase para una instalación inmobiliaria independiente
-- Ejecutar en el SQL Editor del proyecto Supabase.

-- Extensión para UUIDs
create extension if not exists "pgcrypto";

-- ============================================================
-- Tabla: profiles (usuarios del sistema: agentes y admins)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  avatar_url text,
  role text not null default 'agente' check (role in ('admin', 'agente')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Perfiles visibles para usuarios autenticados"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Cada usuario edita su propio perfil"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Trigger: crea el perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Usuario'), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Tabla: categories (tipos de propiedad)
-- ============================================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  icon text,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "Categorías de lectura pública"
  on public.categories for select
  to anon, authenticated
  using (true);

create policy "Solo autenticados crean categorías"
  on public.categories for insert
  to authenticated
  with check (true);

-- ============================================================
-- Tabla: locations (ubicaciones)
-- ============================================================
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  country text not null default 'País',
  created_at timestamptz not null default now()
);

alter table public.locations enable row level security;

create policy "Ubicaciones de lectura pública"
  on public.locations for select
  to anon, authenticated
  using (true);

create policy "Solo autenticados crean ubicaciones"
  on public.locations for insert
  to authenticated
  with check (true);

-- ============================================================
-- Tabla: properties
-- ============================================================
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  slug text not null unique,
  operation text not null default 'venta' check (operation in ('venta', 'alquiler')),
  status text not null default 'borrador' check (status in ('borrador', 'publicada', 'vendida', 'archivada')),
  price numeric not null check (price >= 0),
  currency text not null default 'USD',
  category_id uuid references public.categories (id) on delete set null,
  location_id uuid references public.locations (id) on delete set null,
  address text,
  latitude double precision,
  longitude double precision,
  bedrooms integer,
  bathrooms numeric,
  parking_spaces integer,
  land_area_m2 numeric,
  construction_area_m2 numeric,
  description text,
  features jsonb not null default '[]'::jsonb,
  main_image_url text,
  is_featured boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.properties enable row level security;

create policy "Propiedades publicadas de lectura pública"
  on public.properties for select
  to anon, authenticated
  using (status = 'publicada' or auth.uid() is not null);

create policy "Autenticados pueden crear propiedades"
  on public.properties for insert
  to authenticated
  with check (true);

create policy "Autenticados pueden editar propiedades"
  on public.properties for update
  to authenticated
  using (true);

create policy "Autenticados pueden eliminar propiedades"
  on public.properties for delete
  to authenticated
  using (true);

-- ============================================================
-- Tabla: property_images
-- ============================================================
create table if not exists public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.property_images enable row level security;

create policy "Imágenes de propiedad de lectura pública"
  on public.property_images for select
  to anon, authenticated
  using (true);

create policy "Autenticados pueden gestionar imágenes"
  on public.property_images for all
  to authenticated
  using (true)
  with check (true);

-- ============================================================
-- Tabla: inquiries (solicitudes del formulario de contacto)
-- ============================================================
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  subject text not null,
  message text not null,
  property_id uuid references public.properties (id) on delete set null,
  status text not null default 'nueva' check (status in ('nueva', 'en_proceso', 'cerrada')),
  created_at timestamptz not null default now()
);

alter table public.inquiries enable row level security;

create policy "Solo autenticados leen solicitudes"
  on public.inquiries for select
  to authenticated
  using (true);

create policy "Público puede crear solicitudes"
  on public.inquiries for insert
  to anon, authenticated
  with check (true);

create policy "Autenticados actualizan solicitudes"
  on public.inquiries for update
  to authenticated
  using (true);
