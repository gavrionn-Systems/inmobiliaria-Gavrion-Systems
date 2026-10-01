-- Un evento de dominio solo debe publicarse una vez aunque Meta reintente.
alter table public.outbox_events
  add constraint outbox_events_aggregate_event_unique
  unique (event_type, aggregate_id);

create or replace function public.claim_outbox_events(batch_size integer default 25)
returns setof public.outbox_events
language plpgsql
security definer
set search_path = public
as $$
begin
  if batch_size < 1 or batch_size > 100 then
    raise exception 'batch_size debe estar entre 1 y 100';
  end if;

  return query
  with claimed as (
    select id
    from public.outbox_events
    where (
      (status in ('pending', 'failed') and next_attempt_at <= now())
      or (status = 'processing' and locked_at < now() - interval '10 minutes')
    )
    order by created_at
    for update skip locked
    limit batch_size
  )
  update public.outbox_events as event
  set status = 'processing',
      locked_at = now(),
      attempts = event.attempts + 1
  from claimed
  where event.id = claimed.id
  returning event.*;
end;
$$;

revoke all on function public.claim_outbox_events(integer) from public;
grant execute on function public.claim_outbox_events(integer) to service_role;

create or replace function public.capture_inquiry_in_crm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  contact_uuid uuid;
  conversation_uuid uuid;
begin
  select id into contact_uuid
  from public.contacts
  where lower(email) = lower(new.email)
     or (new.phone is not null and phone = new.phone)
  order by created_at
  limit 1;

  if contact_uuid is null then
    insert into public.contacts (full_name, email, phone, source)
    values (new.full_name, new.email, new.phone, 'web_form')
    returning id into contact_uuid;
  end if;

  insert into public.conversations (
    contact_id,
    channel,
    status,
    last_message_at
  )
  values (contact_uuid, 'web', 'abierta', new.created_at)
  returning id into conversation_uuid;

  insert into public.messages (
    conversation_id,
    direction,
    message_type,
    body,
    status,
    sent_at
  )
  values (
    conversation_uuid,
    'inbound',
    'text',
    new.subject || E'\n\n' || new.message,
    'delivered',
    new.created_at
  );

  insert into public.outbox_events (
    event_type,
    aggregate_type,
    aggregate_id,
    payload
  )
  values (
    'inquiry.created',
    'inquiry',
    new.id,
    jsonb_build_object(
      'inquiry_id', new.id,
      'contact_id', contact_uuid,
      'conversation_id', conversation_uuid,
      'property_id', new.property_id,
      'contact', jsonb_build_object(
        'name', new.full_name,
        'email', new.email,
        'phone', new.phone
      ),
      'subject', new.subject,
      'source', 'web_form'
    )
  )
  on conflict (event_type, aggregate_id) do nothing;

  return new;
end;
$$;

drop trigger if exists capture_inquiry_in_crm on public.inquiries;
create trigger capture_inquiry_in_crm
  after insert on public.inquiries
  for each row execute function public.capture_inquiry_in_crm();
