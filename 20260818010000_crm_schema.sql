-- CRM nativo para WhatsApp Cloud API.

create type public.crm_contact_status as enum ('lead', 'prospecto', 'cliente', 'inactivo');
create type public.crm_conversation_status as enum ('abierta', 'pendiente', 'cerrada');
create type public.crm_message_direction as enum ('inbound', 'outbound');
create type public.crm_message_status as enum ('pending', 'sent', 'delivered', 'read', 'failed');
create type public.crm_task_status as enum ('pendiente', 'completada', 'cancelada');
create type public.crm_opportunity_status as enum ('abierta', 'ganada', 'perdida');
create type public.integration_event_status as enum ('pending', 'processing', 'sent', 'failed');

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  wa_id text unique,
  full_name text not null,
  email text,
  phone text,
  source text not null default 'manual',
  status public.crm_contact_status not null default 'lead',
  assigned_to uuid references public.profiles (id) on delete set null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (wa_id is not null or phone is not null or email is not null)
);

create index contacts_assigned_to_idx on public.contacts (assigned_to);
create index contacts_phone_idx on public.contacts (phone);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'web')),
  status public.crm_conversation_status not null default 'abierta',
  assigned_to uuid references public.profiles (id) on delete set null,
  phone_number_id text,
  customer_service_window_expires_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_contact_idx on public.conversations (contact_id);
create index conversations_assigned_status_idx on public.conversations (assigned_to, status);
create index conversations_last_message_idx on public.conversations (last_message_at desc);

create table public.conversation_assignments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  assigned_to uuid not null references public.profiles (id) on delete restrict,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now()
);

create index conversation_assignments_conversation_idx
  on public.conversation_assignments (conversation_id, assigned_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  direction public.crm_message_direction not null,
  message_type text not null default 'text',
  body text,
  media_url text,
  meta_message_id text unique,
  reply_to_meta_message_id text,
  status public.crm_message_status not null default 'pending',
  template_name text,
  error_code text,
  error_message text,
  sent_by uuid references public.profiles (id) on delete set null,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position integer not null unique check (position >= 0),
  is_closed boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.pipeline_stages (name, position, is_closed)
values
  ('Nuevo lead', 0, false),
  ('Contactado', 1, false),
  ('Visita programada', 2, false),
  ('Negociación', 3, false),
  ('Cerrado', 4, true);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  property_id uuid references public.properties (id) on delete set null,
  stage_id uuid not null references public.pipeline_stages (id) on delete restrict,
  title text not null,
  value numeric check (value is null or value >= 0),
  currency text not null default 'USD' check (currency in ('USD', 'HNL')),
  status public.crm_opportunity_status not null default 'abierta',
  assigned_to uuid references public.profiles (id) on delete set null,
  expected_close_at date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index opportunities_stage_idx on public.opportunities (stage_id);
create index opportunities_assigned_idx on public.opportunities (assigned_to);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete cascade,
  title text not null,
  description text,
  due_at timestamptz,
  status public.crm_task_status not null default 'pendiente',
  assigned_to uuid not null references public.profiles (id) on delete restrict,
  created_by uuid references public.profiles (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (contact_id is not null or opportunity_id is not null)
);

create index tasks_assigned_status_due_idx
  on public.tasks (assigned_to, status, due_at);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  channel text not null default 'whatsapp' check (channel = 'whatsapp'),
  category text not null check (category in ('service', 'utility', 'marketing')),
  granted boolean not null,
  notice_text text not null,
  source text not null,
  source_ip inet,
  recorded_by uuid references public.profiles (id) on delete set null,
  recorded_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index consents_contact_category_idx
  on public.consents (contact_id, category, recorded_at desc);

create table public.suppression_list (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null unique references public.contacts (id) on delete cascade,
  reason text not null,
  source text not null,
  suppressed_by uuid references public.profiles (id) on delete set null,
  suppressed_at timestamptz not null default now()
);

create table public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  meta_template_id text unique,
  name text not null,
  language text not null default 'es',
  category text not null check (category in ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'PAUSED', 'REJECTED', 'DISABLED')),
  body_preview text,
  updated_at timestamptz not null default now(),
  unique (name, language)
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('meta', 'direct')),
  external_event_id text,
  payload jsonb not null,
  status public.integration_event_status not null default 'pending',
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, external_event_id)
);

create index webhook_events_status_created_idx
  on public.webhook_events (status, created_at);

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid,
  payload jsonb not null,
  status public.integration_event_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index outbox_events_dispatch_idx
  on public.outbox_events (status, next_attempt_at, created_at);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index audit_log_actor_created_idx on public.audit_log (actor_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger contacts_set_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();
create trigger conversations_set_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();
create trigger opportunities_set_updated_at before update on public.opportunities
  for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
create trigger whatsapp_templates_set_updated_at before update on public.whatsapp_templates
  for each row execute function public.set_updated_at();

create or replace function public.protect_conversation_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_to is distinct from old.assigned_to and not public.is_admin() then
    raise exception 'Solo un administrador puede reasignar conversaciones';
  end if;
  return new;
end;
$$;

create trigger protect_conversation_assignment_change
  before update on public.conversations
  for each row execute function public.protect_conversation_assignment();

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
      and c.assigned_to = auth.uid()
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
      and (c.assigned_to = auth.uid() or public.can_access_contact(c.contact_id))
  );
$$;

revoke all on function public.can_access_contact(uuid) from public;
revoke all on function public.can_access_conversation(uuid) from public;
grant execute on function public.can_access_contact(uuid) to authenticated;
grant execute on function public.can_access_conversation(uuid) to authenticated;

alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_assignments enable row level security;
alter table public.messages enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.opportunities enable row level security;
alter table public.tasks enable row level security;
alter table public.consents enable row level security;
alter table public.suppression_list enable row level security;
alter table public.whatsapp_templates enable row level security;
alter table public.webhook_events enable row level security;
alter table public.outbox_events enable row level security;
alter table public.audit_log enable row level security;

create policy "Equipo ve contactos asignados"
  on public.contacts for select to authenticated
  using (public.is_admin() or assigned_to = auth.uid());
create policy "Equipo crea contactos propios"
  on public.contacts for insert to authenticated
  with check (
    public.is_admin()
    or (public.is_staff() and assigned_to = auth.uid() and created_by = auth.uid())
  );
create policy "Equipo edita contactos asignados"
  on public.contacts for update to authenticated
  using (public.is_admin() or assigned_to = auth.uid())
  with check (public.is_admin() or assigned_to = auth.uid());
create policy "Admin elimina contactos"
  on public.contacts for delete to authenticated
  using (public.is_admin());

create policy "Equipo ve conversaciones asignadas"
  on public.conversations for select to authenticated
  using (public.can_access_contact(contact_id) or assigned_to = auth.uid());
create policy "Equipo crea conversaciones asignadas"
  on public.conversations for insert to authenticated
  with check (
    public.is_admin()
    or (public.is_staff() and assigned_to = auth.uid() and public.can_access_contact(contact_id))
  );
create policy "Equipo edita conversaciones asignadas"
  on public.conversations for update to authenticated
  using (public.can_access_conversation(id))
  with check (public.can_access_conversation(id));
create policy "Admin elimina conversaciones"
  on public.conversations for delete to authenticated
  using (public.is_admin());

create policy "Equipo ve historial de asignaciones"
  on public.conversation_assignments for select to authenticated
  using (public.can_access_conversation(conversation_id));
create policy "Admin asigna conversaciones"
  on public.conversation_assignments for insert to authenticated
  with check (public.is_admin() and assigned_by = auth.uid());

create policy "Equipo ve mensajes asignados"
  on public.messages for select to authenticated
  using (public.can_access_conversation(conversation_id));
create policy "Equipo crea mensajes salientes"
  on public.messages for insert to authenticated
  with check (
    public.can_access_conversation(conversation_id)
    and direction = 'outbound'
    and sent_by = auth.uid()
  );

create policy "Equipo ve etapas"
  on public.pipeline_stages for select to authenticated
  using (public.is_staff());
create policy "Admin crea etapas"
  on public.pipeline_stages for insert to authenticated
  with check (public.is_admin());
create policy "Admin edita etapas"
  on public.pipeline_stages for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Admin elimina etapas"
  on public.pipeline_stages for delete to authenticated
  using (public.is_admin());

create policy "Equipo ve oportunidades asignadas"
  on public.opportunities for select to authenticated
  using (
    public.is_admin()
    or assigned_to = auth.uid()
    or public.can_access_contact(contact_id)
  );
create policy "Equipo crea oportunidades propias"
  on public.opportunities for insert to authenticated
  with check (
    public.is_admin()
    or (
      public.is_staff()
      and assigned_to = auth.uid()
      and created_by = auth.uid()
      and public.can_access_contact(contact_id)
    )
  );
create policy "Equipo edita oportunidades asignadas"
  on public.opportunities for update to authenticated
  using (public.is_admin() or assigned_to = auth.uid())
  with check (public.is_admin() or assigned_to = auth.uid());
create policy "Admin elimina oportunidades"
  on public.opportunities for delete to authenticated
  using (public.is_admin());

create policy "Equipo ve tareas asignadas"
  on public.tasks for select to authenticated
  using (public.is_admin() or assigned_to = auth.uid());
create policy "Equipo crea tareas propias"
  on public.tasks for insert to authenticated
  with check (
    public.is_admin()
    or (public.is_staff() and assigned_to = auth.uid() and created_by = auth.uid())
  );
create policy "Equipo edita tareas asignadas"
  on public.tasks for update to authenticated
  using (public.is_admin() or assigned_to = auth.uid())
  with check (public.is_admin() or assigned_to = auth.uid());
create policy "Admin elimina tareas"
  on public.tasks for delete to authenticated
  using (public.is_admin());

create policy "Equipo ve consentimientos de sus contactos"
  on public.consents for select to authenticated
  using (public.can_access_contact(contact_id));
create policy "Equipo registra consentimientos"
  on public.consents for insert to authenticated
  with check (
    public.can_access_contact(contact_id)
    and recorded_by = auth.uid()
  );

create policy "Equipo ve supresiones de sus contactos"
  on public.suppression_list for select to authenticated
  using (public.can_access_contact(contact_id));
create policy "Equipo registra bajas"
  on public.suppression_list for insert to authenticated
  with check (
    public.can_access_contact(contact_id)
    and suppressed_by = auth.uid()
  );
create policy "Admin elimina supresiones"
  on public.suppression_list for delete to authenticated
  using (public.is_admin());

create policy "Equipo ve plantillas"
  on public.whatsapp_templates for select to authenticated
  using (public.is_staff());
create policy "Admin administra plantillas"
  on public.whatsapp_templates for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- webhook_events y outbox_events no tienen políticas para authenticated:
-- solo procesos server-side con service role pueden leer o escribir.

create policy "Admin ve auditoria"
  on public.audit_log for select to authenticated
  using (public.is_admin());
create policy "Equipo registra auditoria propia"
  on public.audit_log for insert to authenticated
  with check (public.is_staff() and actor_id = auth.uid());
