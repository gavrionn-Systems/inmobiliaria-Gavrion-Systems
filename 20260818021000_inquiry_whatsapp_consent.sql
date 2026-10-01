alter table public.inquiries
  add column whatsapp_opt_in boolean not null default false,
  add column whatsapp_opt_in_text text,
  add column whatsapp_opt_in_at timestamptz,
  add column source_ip inet;

create or replace function public.record_inquiry_whatsapp_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  contact_uuid uuid;
begin
  if not new.whatsapp_opt_in then
    return new;
  end if;

  select id into contact_uuid
  from public.contacts
  where lower(email) = lower(new.email)
     or (new.phone is not null and phone = new.phone)
  order by created_at
  limit 1;

  if contact_uuid is not null then
    insert into public.consents (
      contact_id,
      channel,
      category,
      granted,
      notice_text,
      source,
      source_ip,
      recorded_at
    )
    values (
      contact_uuid,
      'whatsapp',
      'utility',
      true,
      coalesce(new.whatsapp_opt_in_text, 'Aceptó recibir seguimiento por WhatsApp'),
      'web_form',
      new.source_ip,
      coalesce(new.whatsapp_opt_in_at, new.created_at)
    );
  end if;

  return new;
end;
$$;

create trigger record_inquiry_whatsapp_consent
  after insert on public.inquiries
  for each row execute function public.record_inquiry_whatsapp_consent();
