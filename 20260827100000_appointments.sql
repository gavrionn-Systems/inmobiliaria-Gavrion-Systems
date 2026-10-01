-- Appointments: agenda presencial con buffer de 60min por defecto (configurable)
-- y calendario dual (web + CRM) con aprobación humana

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  property_id uuid references public.properties(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duration_minutes int not null default 60 check (duration_minutes in (30,60,90,120)),
  status text not null default 'pendiente' check (status in ('pendiente','confirmada','cancelada','rechazada','completada')),
  source text not null default 'web' check (source in ('web','crm','chatbot')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at = starts_at + (duration_minutes || ' minutes')::interval),
  check (starts_at < ends_at)
);

create index if not exists appointments_starts_at_idx on public.appointments (starts_at);
create index if not exists appointments_status_idx on public.appointments (status);
-- appointments_date_idx removido: (starts_at::date) sobre timestamptz es STABLE y PG exige IMMUTABLE en índices.
-- La disponibilidad usa rango sobre starts_at (dayStartUTC/dayEndUTC), así que el índice sobre starts_at es suficiente.
-- Si se necesita índice por fecha local, crear columna generada inmutable o usar date_trunc con función wrapper inmutable.

-- trigger updated_at
create or replace function public.handle_appointments_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  -- recalcula ends_at si cambia starts_at o duration
  new.ends_at = new.starts_at + (new.duration_minutes || ' minutes')::interval;
  return new;
end; $$;

drop trigger if exists appointments_updated_at on public.appointments;
create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.handle_appointments_updated_at();

-- RLS: lectura pública solo para disponibilidad vía API (service_role); anon no lee directo
alter table public.appointments enable row level security;

create policy "Public can create appointments"
  on public.appointments for insert to anon, authenticated with check (true);

create policy "Authenticated can read appointments"
  on public.appointments for select to authenticated using (true);

create policy "Authenticated can update appointments"
  on public.appointments for update to authenticated using (true) with check (true);

-- Horario laboral configurable (single row id=1)
create table if not exists public.site_schedule (
  id int primary key check (id = 1),
  work_hours jsonb not null default '{"mon":{"start":"08:00","end":"17:00"},"tue":{"start":"08:00","end":"17:00"},"wed":{"start":"08:00","end":"17:00"},"thu":{"start":"08:00","end":"17:00"},"fri":{"start":"08:00","end":"17:00"},"sat":{"start":"08:00","end":"12:00"},"sun":null}'::jsonb,
  slot_duration_default int not null default 60 check (slot_duration_default in (30,60,90,120)),
  slot_durations int[] not null default array[30,60,90],
  buffer_minutes int not null default 60,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.site_schedule (id) values (1) on conflict (id) do nothing;

alter table public.site_schedule enable row level security;
create policy "Public can read schedule" on public.site_schedule for select to anon, authenticated using (true);
create policy "Authenticated can update schedule" on public.site_schedule for update to authenticated using (true) with check (true);

-- Outbox triggers para agenda presencial
create or replace function public.capture_appointment_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  event_type text;
begin
  if (TG_OP = 'INSERT') then
    event_type := 'appointment.created';
    insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload)
    values (event_type, 'appointment', new.id, jsonb_build_object(
      'appointment_id', new.id,
      'full_name', new.full_name,
      'email', new.email,
      'phone', new.phone,
      'property_id', new.property_id,
      'starts_at', new.starts_at,
      'ends_at', new.ends_at,
      'duration_minutes', new.duration_minutes,
      'status', new.status,
      'source', new.source
    )) on conflict (event_type, aggregate_id) do nothing;
    return new;
  elsif (TG_OP = 'UPDATE' and old.status is distinct from new.status) then
    if new.status = 'confirmada' then event_type := 'appointment.confirmed';
    elsif new.status = 'rechazada' then event_type := 'appointment.rejected';
    elsif new.status = 'cancelada' then event_type := 'appointment.cancelled';
    else event_type := 'appointment.status_changed';
    end if;
    insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload)
    values (event_type, 'appointment', new.id, jsonb_build_object(
      'appointment_id', new.id,
      'full_name', new.full_name,
      'email', new.email,
      'phone', new.phone,
      'starts_at', new.starts_at,
      'ends_at', new.ends_at,
      'status', new.status,
      'previous_status', old.status
    )) on conflict (event_type, aggregate_id) do nothing;
    return new;
  end if;
  return new;
end; $$;

drop trigger if exists capture_appointment_created on public.appointments;
create trigger capture_appointment_created after insert on public.appointments
  for each row execute function public.capture_appointment_event();
drop trigger if exists capture_appointment_status on public.appointments;
create trigger capture_appointment_status after update on public.appointments
  for each row execute function public.capture_appointment_event();
