-- CRM listo para producción: cola compartida, reclamo de hilos, dedup de
-- solicitudes web, parámetros de plantilla y bucket de media.

-- 1. Columnas para plantillas con variables.
alter table public.whatsapp_templates
  add column if not exists components jsonb;

alter table public.messages
  add column if not exists template_params jsonb;

-- 2. Cola compartida: el equipo ve contactos/conversaciones sin asignar.
create or replace function public.can_access_contact(target_contact_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1
    from public.contacts c
    where c.id = target_contact_id
      and (c.assigned_to = auth.uid() or c.assigned_to is null)
  );
$$;

create or replace function public.can_access_conversation(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1
    from public.conversations c
    where c.id = target_conversation_id
      and (
        c.assigned_to = auth.uid()
        or c.assigned_to is null
        or public.can_access_contact(c.contact_id)
      )
  );
$$;

drop policy if exists "Equipo ve contactos asignados" on public.contacts;
create policy "Equipo ve contactos asignados"
  on public.contacts for select to authenticated
  using (
    public.is_admin()
    or assigned_to = auth.uid()
    or assigned_to is null
  );

drop policy if exists "Equipo edita contactos asignados" on public.contacts;
create policy "Equipo edita contactos asignados"
  on public.contacts for update to authenticated
  using (
    public.is_admin()
    or assigned_to = auth.uid()
    or assigned_to is null
  )
  with check (public.is_admin() or assigned_to = auth.uid());

-- 3. El agente puede reclamarse un hilo sin asignar; solo el admin reasigna.
create or replace function public.protect_conversation_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_to is not distinct from old.assigned_to then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;
  if public.is_staff()
     and old.assigned_to is null
     and new.assigned_to = auth.uid() then
    return new;
  end if;
  raise exception 'Solo un administrador puede reasignar conversaciones';
end;
$$;

drop policy if exists "Admin asigna conversaciones" on public.conversation_assignments;
create policy "Equipo registra asignaciones"
  on public.conversation_assignments for insert to authenticated
  with check (
    assigned_by = auth.uid()
    and (
      public.is_admin()
      or (public.is_staff() and assigned_to = auth.uid())
    )
  );

-- 4. Outbox de plantillas incluye parámetros e idioma.
create or replace function public.enqueue_outbound_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_row public.conversations%rowtype;
  contact_row public.contacts%rowtype;
  template_language text;
begin
  if new.direction <> 'outbound' then
    return new;
  end if;

  select * into conversation_row
  from public.conversations
  where id = new.conversation_id;

  if conversation_row.channel <> 'whatsapp' then
    return new;
  end if;

  select * into contact_row
  from public.contacts
  where id = conversation_row.contact_id;

  template_language := coalesce(
    new.template_params ->> 'language',
    (
      select language
      from public.whatsapp_templates
      where name = new.template_name
        and status = 'APPROVED'
      limit 1
    ),
    'es'
  );

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
      'template_name', new.template_name,
      'template_language', template_language,
      'template_params', coalesce(new.template_params, '{}'::jsonb)
    )
  )
  on conflict (event_type, aggregate_id) do nothing;

  return new;
end;
$$;

-- 5. Dedup de solicitudes web por email/teléfono y reutiliza conversación abierta.
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
  phone_digits text;
begin
  phone_digits := nullif(regexp_replace(coalesce(new.phone, ''), '\D', '', 'g'), '');

  if new.email is not null and length(trim(new.email)) > 0 then
    select id into contact_uuid
    from public.contacts
    where lower(email) = lower(trim(new.email))
    order by updated_at desc
    limit 1;
  end if;

  if contact_uuid is null and phone_digits is not null then
    select id into contact_uuid
    from public.contacts
    where regexp_replace(coalesce(phone, ''), '\D', '', 'g') = phone_digits
       or wa_id = phone_digits
    order by updated_at desc
    limit 1;
  end if;

  if contact_uuid is null then
    insert into public.contacts (full_name, email, phone, source)
    values (new.full_name, new.email, new.phone, 'web_form')
    returning id into contact_uuid;
  else
    update public.contacts
    set
      email = coalesce(email, new.email),
      phone = coalesce(phone, new.phone),
      full_name = case
        when full_name ~ '^[0-9]+$' then new.full_name
        else full_name
      end
    where id = contact_uuid;
  end if;

  new.crm_contact_id := contact_uuid;

  select id into conversation_uuid
  from public.conversations
  where contact_id = contact_uuid
    and channel = 'web'
    and status <> 'cerrada'
  order by last_message_at desc nulls last
  limit 1;

  if conversation_uuid is null then
    insert into public.conversations (
      contact_id,
      channel,
      status,
      last_message_at
    )
    values (contact_uuid, 'web', 'abierta', new.created_at)
    returning id into conversation_uuid;
  else
    update public.conversations
    set
      status = 'abierta',
      last_message_at = new.created_at
    where id = conversation_uuid;
  end if;

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

-- 6. Bucket privado para adjuntos de WhatsApp.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'crm-media',
  'crm-media',
  false,
  16777216,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'audio/ogg',
    'audio/mpeg',
    'application/pdf',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Equipo ve media CRM" on storage.objects;
drop policy if exists "Servicio escribe media CRM" on storage.objects;

create policy "Equipo ve media CRM"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'crm-media' and public.is_staff());
