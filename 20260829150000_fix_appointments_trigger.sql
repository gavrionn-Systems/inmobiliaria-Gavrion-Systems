-- Fix: event_type variable ambigua en capture_appointment_event
-- El ON CONFLICT (event_type, aggregate_id) se vuelve ambiguo cuando existe una variable PL/pgSQL con el mismo nombre.
-- Se renombra a v_event_type para eliminar la ambigüedad 42702.

create or replace function public.capture_appointment_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_event_type text;
begin
  if (TG_OP = 'INSERT') then
    v_event_type := 'appointment.created';
    insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload)
    values (v_event_type, 'appointment', new.id, jsonb_build_object(
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
    if new.status = 'confirmada' then v_event_type := 'appointment.confirmed';
    elsif new.status = 'rechazada' then v_event_type := 'appointment.rejected';
    elsif new.status = 'cancelada' then v_event_type := 'appointment.cancelled';
    else v_event_type := 'appointment.status_changed';
    end if;
    insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload)
    values (v_event_type, 'appointment', new.id, jsonb_build_object(
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
