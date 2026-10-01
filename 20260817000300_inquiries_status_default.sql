-- Refuerza el default de status en inquiries (la base remota lo perdió)
alter table public.inquiries
  alter column status set default 'nueva';