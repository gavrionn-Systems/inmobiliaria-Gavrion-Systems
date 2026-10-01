-- Textos del hero de portada (Agent C los consume vía getSiteSettings).
alter table public.site_settings
  add column if not exists hero_title text not null default '',
  add column if not exists hero_subtitle text not null default '';

update public.site_settings
set
  hero_title = case
    when coalesce(trim(hero_title), '') = '' then
      'Encuentre el espacio ideal para usted'
    else hero_title
  end,
  hero_subtitle = case
    when coalesce(trim(hero_subtitle), '') = '' then
      'Soluciones inmobiliarias de primer nivel con la confianza y precisión que usted merece.'
    else hero_subtitle
  end
where id = 1;
