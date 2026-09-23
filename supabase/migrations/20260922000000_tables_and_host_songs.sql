-- Configurable number of tables, and songs queued by the animador.

-- Table 999 belongs to the animador; inactive so guests cannot pick it.
insert into tables (number, label, active) values (999, 'Animador', false)
on conflict (number) do update set label = 'Animador', active = false;

create or replace function set_table_count(p_count integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_count < 1 or p_count > 500 then raise exception 'Cantidad de mesas inválida'; end if;
  insert into tables (number, active) select g, true from generate_series(1, p_count) g
  on conflict (number) do update set active = true;
  update tables set active = false where number > p_count and number <> 999;
end $$;

create or replace function table_count() returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from tables where active and number <> 999
$$;

-- The animador's own song: enters the queue directly, no selfie, no approval.
create or replace function create_host_request(p_session uuid, p_song uuid, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_device uuid; v_participant uuid; v_request uuid; v_order integer;
begin
  if not exists (select 1 from songs where id = p_song and embeddable and status = 'ok') then
    raise exception 'Video no disponible';
  end if;
  insert into device_sessions (table_number) values (999) returning id into v_device;
  insert into participants (device_session_id, display_name, table_number)
  values (v_device, coalesce(nullif(trim(p_name), ''), 'Animador'), 999) returning id into v_participant;
  select coalesce(max(queue_order), 0) + 1 into v_order from requests where session_id = p_session;
  insert into requests (session_id, participant_id, song_id, status, queue_order, approved_at)
  values (p_session, v_participant, p_song, 'QUEUED', v_order, now()) returning id into v_request;
  perform bump_queue(p_session);
  return v_request;
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;

-- The venue has 45 tables.
select set_table_count(45);
