-- Automatización CRM: oportunidad automática por consulta de propiedad,
-- soporte del canal web en los triggers de salida, enlace inquiry→conversación
-- y Realtime para la bandeja de mensajes.

-- 1. Enlace directo de la solicitud con su conversación CRM (la UI de
--    solicitudes enlaza al inbox sin buscar por contacto).
alter table public.inquiries
  add column crm_conversation_id uuid references public.conversations (id) on delete set null;

-- 2. El canal web no usa WhatsApp: sin ventana de 24 h ni plantillas ni
--    outbox. El mensaje saliente queda solo en BD como 'sent'.
--    La supresión (opt-out) se respeta en ambos canales.
create or replace function public.enforce_outbound_message_compliance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_row public.conversations%rowtype;
  template_row public.whatsapp_templates%rowtype;
  consent_category text;
  has_consent boolean;
begin
  if new.direction <> 'outbound' then
    return new;
  end if;

  select * into conversation_row
  from public.conversations
  where id = new.conversation_id;

  if conversation_row.id is null then
    raise exception 'Conversación inexistente';
  end if;

  if exists (
    select 1 from public.suppression_list
    where contact_id = conversation_row.contact_id
  ) then
    raise exception 'El contacto solicitó no recibir mensajes';
  end if;

  if conversation_row.channel = 'web' then
    new.status := 'sent';
    new.sent_at := coalesce(new.sent_at, now());
    new.sent_by := coalesce(new.sent_by, auth.uid());
    new.template_name := null;
    return new;
  end if;

  if conversation_row.customer_service_window_expires_at is null
     or conversation_row.customer_service_window_expires_at <= now() then
    if new.template_name is null then
      raise exception 'Fuera de la ventana de 24 horas se requiere una plantilla';
    end if;

    select * into template_row
    from public.whatsapp_templates
    where name = new.template_name
      and status = 'APPROVED'
    limit 1;

    if template_row.id is null then
      raise exception 'La plantilla no está aprobada';
    end if;

    consent_category := case
      when template_row.category = 'MARKETING' then 'marketing'
      else 'utility'
    end;

    select coalesce((
      select granted and revoked_at is null
      from public.consents
      where contact_id = conversation_row.contact_id
        and category = consent_category
      order by recorded_at desc
      limit 1
    ), false) into has_consent;

    if not has_consent then
      raise exception 'No existe consentimiento vigente para esta categoría';
    end if;
  end if;

  new.status := 'pending';
  new.sent_by := auth.uid();
  return new;
end;
$$;

create or replace function public.enqueue_outbound_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_row public.conversations%rowtype;
  contact_row public.contacts%rowtype;
begin
  if new.direction <> 'outbound' then
    return new;
  end if;

  select * into conversation_row
  from public.conversations
  where id = new.conversation_id;

  -- Solo WhatsApp pasa por el outbox; el canal web vive únicamente en BD.
  if conversation_row.channel <> 'whatsapp' then
    return new;
  end if;

  select * into contact_row
  from public.contacts
  where id = conversation_row.contact_id;

  insert into public.outbox_events (
    event_type,
    aggregate_type,
    aggregate_id,
    payload
  )
  values (
    'whatsapp.message.send',
    'message',
    new.id,
    jsonb_build_object(
      'message_id', new.id,
      'conversation_id', new.conversation_id,
      'to', coalesce(contact_row.wa_id, contact_row.phone),
      'phone_number_id', conversation_row.phone_number_id,
      'message_type', new.message_type,
      'body', new.body,
      'template_name', new.template_name
    )
  )
  on conflict (event_type, aggregate_id) do nothing;

  return new;
end;
$$;

-- 3. Captura de solicitudes: además de contacto+conversación+mensaje, cuando
--    la solicitud referencia una propiedad se crea una oportunidad en la
--    etapa inicial (posición 0). Idempotente: no duplica si el contacto ya
--    tiene una oportunidad abierta para esa propiedad.
create or replace function public.capture_inquiry_in_crm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  contact_uuid uuid;
  conversation_uuid uuid;
  initial_stage_uuid uuid;
  property_title text;
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

  new.crm_conversation_id := conversation_uuid;

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

  if new.property_id is not null then
    select title into property_title
    from public.properties
    where id = new.property_id;

    select id into initial_stage_uuid
    from public.pipeline_stages
    where position = 0
    limit 1;

    if property_title is not null and initial_stage_uuid is not null
       and not exists (
         select 1
         from public.opportunities
         where contact_id = contact_uuid
           and property_id = new.property_id
           and status = 'abierta'
       ) then
      insert into public.opportunities (
        contact_id,
        property_id,
        stage_id,
        title,
        status
      )
      values (
        contact_uuid,
        new.property_id,
        initial_stage_uuid,
        'Consulta: ' || property_title,
        'abierta'
      );
    end if;
  end if;

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

-- 4. Realtime en la bandeja: el panel se suscribe a INSERT/UPDATE de
--    public.messages (respeta RLS con la anon key + sesión del agente).
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'La publicación supabase_realtime no existe; habilitar Realtime manualmente.';
end;
$$;
