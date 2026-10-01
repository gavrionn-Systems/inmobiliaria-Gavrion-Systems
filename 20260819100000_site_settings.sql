-- Configuración pública de la inmobiliaria (una sola fila).
-- Lectura anónima; escritura solo admin (el panel también usa service role).

create table if not exists public.site_settings (
  id smallint primary key default 1 check (id = 1),
  name text not null,
  site_url text not null,
  email text not null,
  phone text not null,
  whatsapp text not null,
  address_line1 text not null default '',
  address_line2 text not null default '',
  logo_url text not null,
  hero_image_url text not null,
  instagram text not null default '#',
  facebook text not null default '#',
  hours text not null default '',
  about_mission text not null default '',
  about_stats jsonb not null default '[]'::jsonb,
  about_values jsonb not null default '[]'::jsonb,
  default_agent_name text not null default '',
  default_agent_role text not null default '',
  updated_at timestamptz not null default now()
);

comment on table public.site_settings is
  'Identidad y textos de la inmobiliaria. Siempre una fila (id = 1).';

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row
  execute function public.set_updated_at();

alter table public.site_settings enable row level security;

drop policy if exists "site_settings_public_read" on public.site_settings;
create policy "site_settings_public_read"
  on public.site_settings
  for select
  using (true);

drop policy if exists "site_settings_admin_insert" on public.site_settings;
create policy "site_settings_admin_insert"
  on public.site_settings
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "site_settings_admin_update" on public.site_settings;
create policy "site_settings_admin_update"
  on public.site_settings
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on table public.site_settings to anon, authenticated;
grant insert, update on table public.site_settings to authenticated;

insert into public.site_settings (
  id,
  name,
  site_url,
  email,
  phone,
  whatsapp,
  address_line1,
  address_line2,
  logo_url,
  hero_image_url,
  instagram,
  facebook,
  hours,
  about_mission,
  about_stats,
  about_values,
  default_agent_name,
  default_agent_role
)
values (
  1,
  'Nombre de la inmobiliaria',
  'https://ejemplo.com',
  'contacto@ejemplo.com',
  '+000 0000 0000',
  '',
  'Ciudad, país',
  '',
  'https://placehold.co/1200x630/png?text=Portada',
  'https://placehold.co/256x256/png?text=Logo',
  '#',
  '#',
  E'Lunes a viernes, 8:00 a.m. – 5:00 p.m.\nSábados, 9:00 a.m. – 1:00 p.m.',
  E'Ofrecemos acompañamiento profesional para ayudar a nuestros clientes a tomar mejores decisiones inmobiliarias.\n\nPersonalice este texto desde la sección Contenido del sitio.',
  '[
    {"value": "—", "label": "Propiedades gestionadas"},
    {"value": "—", "label": "Años de experiencia"},
    {"value": "—", "label": "Clientes atendidos"},
    {"value": "—", "label": "Agentes del equipo"}
  ]'::jsonb,
  '[
    {"icon": "verified", "title": "Precisión", "description": "Datos verificados y procesos transparentes en cada transacción."},
    {"icon": "handshake", "title": "Confianza", "description": "Construimos relaciones duraderas con nuestros clientes, basadas en honestidad."},
    {"icon": "bolt", "title": "Eficiencia", "description": "Tecnología y metodología moderna para mover su propiedad más rápido."}
  ]'::jsonb,
  'Equipo inmobiliario',
  'Asesor inmobiliario'
)
on conflict (id) do nothing;
