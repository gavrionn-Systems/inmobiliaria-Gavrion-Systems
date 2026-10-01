-- Mapa de la propiedad (imagen estática para la página pública)
alter table public.properties
  add column if not exists map_image_url text;