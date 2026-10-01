-- Datos de contacto y auditoría para el directorio de equipo.

alter table public.profiles
  add column if not exists phone text,
  add column if not exists updated_at timestamptz not null default now();
