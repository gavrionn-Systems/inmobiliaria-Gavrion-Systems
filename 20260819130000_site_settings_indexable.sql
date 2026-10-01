-- Indexación pública (robots / sitemap / metadatos).
-- Por defecto apagada hasta que el catálogo real esté listo para lanzar.

alter table public.site_settings
  add column if not exists indexable boolean not null default false;

comment on column public.site_settings.indexable is
  'Si es false, robots.txt y metadatos marcan noindex. Activar en Configuración al lanzar.';
