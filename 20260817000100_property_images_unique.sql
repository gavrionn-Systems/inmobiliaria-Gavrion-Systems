-- Restricción única para poder usar ON CONFLICT en las imágenes
alter table public.property_images
  add constraint property_images_property_id_url_key unique (property_id, url);