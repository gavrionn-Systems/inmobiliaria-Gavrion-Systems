-- Endurecimiento posterior a la revisión de seguridad.

alter table public.profiles
  add column is_active boolean not null default false;

-- Conserva el acceso de administradores ya promovidos. Los agentes existentes
-- deben activarse explícitamente después de revisar su identidad.
update public.profiles set is_active = true where role = 'admin';

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.role is distinct from old.role
    or new.is_active is distinct from old.is_active
  )
  and not public.is_admin()
  and coalesce(auth.role(), '') <> 'service_role'
  and session_user <> 'postgres' then
    raise exception 'Solo un administrador puede cambiar roles o activar usuarios';
  end if;
  return new;
end;
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active
      and role in ('admin', 'agente')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active
      and role = 'admin'
  );
$$;

-- Cada formulario crea su propio registro CRM. No se fusiona una declaración
-- anónima con un contacto existente solo porque coincida email o teléfono.
alter table public.inquiries
  add column crm_contact_id uuid references public.contacts (id) on delete set null;

drop policy if exists "Público puede crear solicitudes" on public.inquiries;

drop trigger if exists capture_inquiry_in_crm on public.inquiries;

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
  insert into public.contacts (full_name, email, phone, source)
  values (new.full_name, new.email, new.phone, 'web_form')
  returning id into contact_uuid;

  new.crm_contact_id := contact_uuid;

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

create trigger capture_inquiry_in_crm
  before insert on public.inquiries
  for each row execute function public.capture_inquiry_in_crm();

create or replace function public.record_inquiry_whatsapp_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.whatsapp_opt_in and new.crm_contact_id is not null then
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
      new.crm_contact_id,
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

alter table public.webhook_events
  add column processing_started_at timestamptz;

update public.webhook_events
set processing_started_at = created_at
where status = 'processing';

-- Reclama un webhook de forma atómica. Solo una petición concurrente obtiene
-- claimed=true; los eventos fallidos sí pueden reclamarse para reintento.
create or replace function public.claim_webhook_event(
  event_provider text,
  event_external_id text,
  event_payload jsonb
)
returns table (event_id uuid, event_status public.integration_event_status, claimed boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  insert into public.webhook_events (
    provider,
    external_event_id,
    payload,
    status,
    processing_started_at
  )
  values (
    event_provider,
    event_external_id,
    event_payload,
    'processing',
    now()
  )
  on conflict (provider, external_event_id) do nothing
  returning id, status, true;

  if found then
    return;
  end if;

  return query
  update public.webhook_events
  set status = 'processing',
      payload = event_payload,
      error_message = null,
      processing_started_at = now()
  where provider = event_provider
    and external_event_id = event_external_id
    and status = 'failed'
  returning id, status, true;

  if found then
    return;
  end if;

  return query
  update public.webhook_events
  set payload = event_payload,
      processing_started_at = now(),
      error_message = null
  where provider = event_provider
    and external_event_id = event_external_id
    and status = 'processing'
    and processing_started_at < now() - interval '10 minutes'
  returning id, status, true;

  if found then
    return;
  end if;

  return query
  select id, status, false
  from public.webhook_events
  where provider = event_provider
    and external_event_id = event_external_id
  limit 1;
end;
$$;

revoke all on function public.claim_webhook_event(text, text, jsonb) from public;
grant execute on function public.claim_webhook_event(text, text, jsonb) to service_role;
