-- Buscador: configuración del rango de precio administrable.
alter table public.site_settings
  add column if not exists price_step integer not null default 5000 check (price_step >= 1000 and price_step <= 50000),
  add column if not exists price_floor integer not null default 0 check (price_floor >= 0),
  add column if not exists price_ceiling_override integer check (price_ceiling_override is null or price_ceiling_override >= 10000);

comment on column public.site_settings.price_step is 'Paso del slider de precio en USD (por defecto 5000).';
comment on column public.site_settings.price_floor is 'Precio mínimo del slider.';
comment on column public.site_settings.price_ceiling_override is 'Si se define, techo fijo del slider; si no, se calcula desde el máximo publicado.';
