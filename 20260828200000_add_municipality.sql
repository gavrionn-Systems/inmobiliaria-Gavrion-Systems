-- Añade municipio como campo separado (sencillo, sin FK)
alter table public.properties add column if not exists municipality text;
