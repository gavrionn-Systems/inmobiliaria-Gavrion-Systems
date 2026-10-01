-- Performance tuning editable desde Admin / Configuración
-- Evita redeploys para ajustar catálogo, caché ISR, imágenes y UX.

alter table public.site_settings
  add column if not exists catalog_per_page smallint not null default 12 check (catalog_per_page between 6 and 48),
  add column if not exists featured_limit smallint not null default 6 check (featured_limit between 3 and 12),
  add column if not exists related_limit smallint not null default 3 check (related_limit between 0 and 6),
  add column if not exists revalidate_home integer not null default 60 check (revalidate_home between 30 and 600),
  add column if not exists revalidate_catalog integer not null default 60 check (revalidate_catalog between 30 and 600),
  add column if not exists revalidate_property integer not null default 60 check (revalidate_property between 30 and 600),
  add column if not exists image_quality smallint not null default 75 check (image_quality between 60 and 90),
  add column if not exists hero_priority boolean not null default true,
  add column if not exists enable_animations boolean not null default true,
  add column if not exists search_debounce_ms integer not null default 350 check (search_debounce_ms between 100 and 800),
  add column if not exists price_slider_debounce_ms integer not null default 300 check (price_slider_debounce_ms between 100 and 600);

comment on column public.site_settings.catalog_per_page is 'Propiedades por página en /propiedades (6–48). Afecta payload y TTFB.';
comment on column public.site_settings.featured_limit is 'Cuántas destacadas se muestran en portada (3–12). Afecta LCP.';
comment on column public.site_settings.related_limit is 'Cuántas similares en detalle (0–6).';
comment on column public.site_settings.revalidate_home is 'ISR portada en segundos (30–600).';
comment on column public.site_settings.revalidate_catalog is 'ISR catálogo en segundos.';
comment on column public.site_settings.revalidate_property is 'ISR detalle de propiedad en segundos.';
comment on column public.site_settings.image_quality is 'Calidad Next/Image (60–90).';
comment on column public.site_settings.hero_priority is 'Si true, hero usa priority (LCP).';
comment on column public.site_settings.enable_animations is 'Si false, desactiva animaciones decorativas (mejora INP en gama baja).';
comment on column public.site_settings.search_debounce_ms is 'Debounce buscador catálogo (ms).';
comment on column public.site_settings.price_slider_debounce_ms is 'Debounce slider precio (ms).';
