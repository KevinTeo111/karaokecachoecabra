-- Cacho e' Cabra Karaoke · initial schema
-- Run in the Supabase SQL editor or with `supabase db push`.
-- Every mutation goes through the functions below, called by the Next.js
-- server with the service role. Browsers never touch tables directly:
-- RLS is enabled everywhere with no policies for anon/authenticated.

create extension if not exists pgcrypto;
create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------- types
do $$ begin
  create type request_status as enum
    ('PENDING','APPROVED','QUEUED','CALLED','PLAYING','COMPLETED','REJECTED','CANCELLED','SKIPPED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type admin_role as enum ('OWNER','HOST');
exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------- tables
create table if not exists karaoke_sessions (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  status        text not null default 'OPEN' check (status in ('OPEN','CLOSED')),
  starts_at     text not null default '20:00',
  ends_at       text not null default '02:00',
  settings      jsonb not null default '{}'::jsonb,
  queue_version integer not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists tables (
  number integer primary key check (number between 1 and 999),
  label  text,
  active boolean not null default true
);

create table if not exists device_sessions (
  id           uuid primary key default gen_random_uuid(),
  table_number integer references tables(number),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists participants (
  id                uuid primary key default gen_random_uuid(),
  device_session_id uuid not null references device_sessions(id),
  display_name      text not null check (char_length(display_name) between 2 and 24),
  table_number      integer not null references tables(number),
  selfie_path       text,
  selfie_expires_at timestamptz,
  created_at        timestamptz not null default now()
);

create table if not exists songs (
  id               uuid primary key default gen_random_uuid(),
  youtube_video_id text not null unique,
  title            text not null,
  artist_guess     text not null default '',
  channel_title    text not null default '',
  duration_sec     integer not null default 0,
  embeddable       boolean not null default true,
  verified         boolean not null default false,
  favorite         boolean not null default false,
  status           text not null default 'ok' check (status in ('ok','unavailable','not_embeddable')),
  source           text not null default 'catalog' check (source in ('catalog','search','host')),
  search_text      text generated always as
                   (lower(title || ' ' || artist_guess || ' ' || channel_title)) stored,
  created_at       timestamptz not null default now()
);
create index if not exists songs_search_trgm on songs using gin (search_text gin_trgm_ops);

create table if not exists requests (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references karaoke_sessions(id),
  participant_id   uuid not null references participants(id),
  song_id          uuid not null references songs(id),
  status           request_status not null default 'PENDING',
  queue_order      integer,
  requested_at     timestamptz not null default now(),
  approved_at      timestamptz,
  reject_reason    text,
  replaced_song_id uuid references songs(id),
  updated_at       timestamptz not null default now()
);
create index if not exists requests_session_status on requests (session_id, status);

create table if not exists performances (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null unique references requests(id),
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  paused       boolean not null default false,
  player_time  numeric(8,2) not null default 0,
  tick_at      timestamptz not null default now(),
  final_rating numeric(3,1),
  vote_count   integer not null default 0,
  rank         integer
);

create table if not exists votes (
  id                      uuid primary key default gen_random_uuid(),
  performance_id          uuid not null references performances(id),
  voter_device_session_id uuid not null references device_sessions(id),
  stars                   smallint not null check (stars between 1 and 5),
  created_at              timestamptz not null default now(),
  unique (performance_id, voter_device_session_id)
);

create table if not exists admin_users (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         admin_role not null default 'HOST',
  display_name text
);

create table if not exists audit_log (
  id          bigserial primary key,
  admin_id    uuid,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  payload     jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists youtube_search_cache (
  normalized_query text primary key,
  results          jsonb not null,
  expires_at       timestamptz not null
);

-- ------------------------------------------------------------------ RLS
alter table karaoke_sessions     enable row level security;
alter table tables               enable row level security;
alter table device_sessions      enable row level security;
alter table participants         enable row level security;
alter table songs                enable row level security;
alter table requests             enable row level security;
alter table performances         enable row level security;
alter table votes                enable row level security;
alter table admin_users          enable row level security;
alter table audit_log            enable row level security;
alter table youtube_search_cache enable row level security;

-- Admins may read their own role row (used by the panel middleware).
drop policy if exists admin_users_self on admin_users;
create policy admin_users_self on admin_users for select to authenticated using (id = auth.uid());

-- ------------------------------------------------------------- helpers
create or replace function setting_int(p_session uuid, p_key text, p_default integer)
returns integer language sql stable as $$
  select coalesce((settings ->> p_key)::integer, p_default) from karaoke_sessions where id = p_session
$$;

create or replace function setting_bool(p_session uuid, p_key text, p_default boolean)
returns boolean language sql stable as $$
  select coalesce((settings ->> p_key)::boolean, p_default) from karaoke_sessions where id = p_session
$$;

create or replace function can_transition(p_from request_status, p_to request_status)
returns boolean language sql immutable as $$
  select case p_from
    when 'PENDING'  then p_to in ('APPROVED','REJECTED','CANCELLED')
    when 'APPROVED' then p_to in ('QUEUED','CANCELLED')
    when 'QUEUED'   then p_to in ('CALLED','PLAYING','CANCELLED','SKIPPED')
    when 'CALLED'   then p_to in ('PLAYING','QUEUED','CANCELLED','SKIPPED')
    when 'PLAYING'  then p_to in ('COMPLETED','SKIPPED')
    else false end
$$;

create or replace function transition_request(p_request uuid, p_to request_status)
returns requests language plpgsql as $$
declare r requests;
begin
  select * into r from requests where id = p_request for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if not can_transition(r.status, p_to) then
    raise exception 'Transición inválida: % → %', r.status, p_to;
  end if;
  update requests set status = p_to, updated_at = now() where id = p_request returning * into r;
  return r;
end $$;

create or replace function bump_queue(p_session uuid) returns void language sql as $$
  update karaoke_sessions set queue_version = queue_version + 1 where id = p_session
$$;

-- ------------------------------------------------------------- devices
create or replace function touch_device(p_device uuid, p_table integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into device_sessions (id, table_number)
  values (p_device, (select number from tables where number = p_table and active))
  on conflict (id) do update
    set last_seen_at = now(),
        table_number = coalesce(excluded.table_number, device_sessions.table_number);
end $$;

-- -------------------------------------------------------------- guests
create or replace function create_request(
  p_session uuid, p_device uuid, p_song uuid, p_name text, p_table integer,
  p_selfie_path text, p_retention_hours integer
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_active integer;
  v_limit  integer := setting_int(p_session, 'maxActiveRequestsPerDevice', 1);
  v_participant uuid;
  v_request uuid;
begin
  if (select status from karaoke_sessions where id = p_session) <> 'OPEN' then
    raise exception 'El karaoke está cerrado';
  end if;
  if not exists (select 1 from tables where number = p_table and active) then
    raise exception 'Mesa no válida';
  end if;
  if not exists (select 1 from songs where id = p_song and embeddable and status = 'ok') then
    raise exception 'Video no disponible';
  end if;
  select count(*) into v_active
    from requests r join participants p on p.id = r.participant_id
   where r.session_id = p_session and p.device_session_id = p_device
     and r.status in ('PENDING','APPROVED','QUEUED','CALLED','PLAYING');
  if v_active >= v_limit then raise exception 'Ya tienes una canción activa'; end if;

  insert into participants (device_session_id, display_name, table_number, selfie_path, selfie_expires_at)
  values (p_device, p_name, p_table, p_selfie_path, now() + make_interval(hours => p_retention_hours))
  returning id into v_participant;

  insert into requests (session_id, participant_id, song_id)
  values (p_session, v_participant, p_song) returning id into v_request;
  return v_request;
end $$;

create or replace function cancel_own_request(p_request uuid, p_device uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_req requests;
begin
  select rq.* into v_req from requests rq join participants pt on pt.id = rq.participant_id
   where rq.id = p_request and pt.device_session_id = p_device;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  perform transition_request(p_request, 'CANCELLED');
  update requests set queue_order = null where id = p_request;
  perform bump_queue(v_req.session_id);
end $;

create or replace function cast_vote(p_performance uuid, p_device uuid, p_stars smallint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_perf   performances;
  v_req    requests;
  v_singer participants;
  v_voter_table integer;
begin
  select * into v_perf from performances where id = p_performance;
  if not found then raise exception 'Presentación no encontrada'; end if;
  if v_perf.ended_at is not null then raise exception 'La votación ya cerró'; end if;
  select * into v_req from requests where id = v_perf.request_id;
  select * into v_singer from participants where id = v_req.participant_id;
  if v_singer.device_session_id = p_device then raise exception 'No puedes votarte a ti mismo'; end if;
  if setting_bool(v_req.session_id, 'blockSameTableVote', false) then
    select table_number into v_voter_table from device_sessions where id = p_device;
    if v_voter_table = v_singer.table_number then
      raise exception 'Tu mesa no puede votar por su propio cantante';
    end if;
  end if;
  begin
    insert into votes (performance_id, voter_device_session_id, stars) values (p_performance, p_device, p_stars);
  exception when unique_violation then
    raise exception 'Ya votaste esta presentación';
  end;
end $$;

create or replace function tick_performance(p_performance uuid, p_time numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  update performances set player_time = greatest(0, p_time), tick_at = now()
   where id = p_performance and ended_at is null;
end $$;

-- --------------------------------------------------------------- admin
create or replace function approve_request(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r requests; v_order integer;
begin
  r := transition_request(p_request, 'APPROVED');
  select coalesce(max(queue_order), 0) + 1 into v_order from requests where session_id = r.session_id;
  update requests set status = 'QUEUED', queue_order = v_order, approved_at = now(), updated_at = now()
   where id = p_request;
  perform bump_queue(r.session_id);
end $$;

create or replace function reject_request(p_request uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform transition_request(p_request, 'REJECTED');
  update requests set reject_reason = nullif(p_reason, '') where id = p_request;
end $$;

create or replace function cancel_request(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r requests;
begin
  r := transition_request(p_request, 'CANCELLED');
  update requests set queue_order = null where id = p_request;
  perform bump_queue(r.session_id);
end $$;

create or replace function call_request(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform transition_request(p_request, 'CALLED');
end $$;

create or replace function replace_request_song(p_request uuid, p_song uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from songs where id = p_song and embeddable) then
    raise exception 'Video no disponible';
  end if;
  update requests set replaced_song_id = song_id, song_id = p_song, updated_at = now()
   where id = p_request and status in ('PENDING','APPROVED','QUEUED','CALLED');
  if not found then raise exception 'No se puede reemplazar ahora'; end if;
end $$;

create or replace function reorder_queue(p_session uuid, p_ids uuid[], p_expected_version integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_version integer;
begin
  select queue_version into v_version from karaoke_sessions where id = p_session for update;
  if p_expected_version is not null and v_version <> p_expected_version then
    raise exception 'La cola cambió; vuelve a intentarlo';
  end if;
  update requests r set queue_order = x.ord, updated_at = now()
    from unnest(p_ids) with ordinality as x(id, ord)
   where r.id = x.id and r.session_id = p_session and r.status in ('QUEUED','CALLED');
  perform bump_queue(p_session);
end $$;

create or replace function start_performance(p_request uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare r requests; v_perf uuid;
begin
  select * into r from requests where id = p_request;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if exists (select 1 from requests where session_id = r.session_id and status = 'PLAYING') then
    raise exception 'Ya hay alguien cantando';
  end if;
  perform transition_request(p_request, 'PLAYING');
  insert into performances (request_id) values (p_request) returning id into v_perf;
  perform bump_queue(r.session_id);
  return v_perf;
end $$;

create or replace function pause_performance(p_performance uuid)
returns void language sql security definer set search_path = public as $$
  update performances set paused = true, tick_at = now() where id = p_performance and ended_at is null
$$;

create or replace function resume_performance(p_performance uuid)
returns void language sql security definer set search_path = public as $$
  update performances set paused = false, tick_at = now() where id = p_performance and ended_at is null
$$;

create or replace function recompute_ranking(p_session uuid)
returns void language plpgsql as $$
declare v_min integer := setting_int(p_session, 'minVotesForRanking', 3);
begin
  update performances p set rank = null
    from requests r where r.id = p.request_id and r.session_id = p_session;
  with ranked as (
    select p.id, row_number() over (order by p.final_rating desc, p.vote_count desc, p.ended_at asc) as rn
      from performances p join requests r on r.id = p.request_id
     where r.session_id = p_session and r.status = 'COMPLETED'
       and p.final_rating is not null and p.vote_count >= v_min
  )
  update performances p set rank = ranked.rn from ranked where p.id = ranked.id;
end $$;

create or replace function finish_performance(p_performance uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_perf performances; r requests; v_avg numeric; v_count integer;
begin
  select * into v_perf from performances where id = p_performance for update;
  if not found then raise exception 'Presentación no encontrada'; end if;
  r := transition_request(v_perf.request_id, 'COMPLETED');
  select round(avg(stars)::numeric, 1), count(*) into v_avg, v_count from votes where performance_id = p_performance;
  update performances set ended_at = now(), paused = false, final_rating = v_avg, vote_count = v_count
   where id = p_performance;
  perform recompute_ranking(r.session_id);
  perform bump_queue(r.session_id);
end $$;

create or replace function skip_request(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r requests;
begin
  r := transition_request(p_request, 'SKIPPED');
  update requests set queue_order = null where id = p_request;
  update performances set ended_at = now(), paused = false where request_id = p_request and ended_at is null;
  perform bump_queue(r.session_id);
end $$;

create or replace function set_session_status(p_session uuid, p_status text)
returns void language sql security definer set search_path = public as $$
  update karaoke_sessions set status = p_status where id = p_session and p_status in ('OPEN','CLOSED')
$$;

create or replace function update_session_settings(p_session uuid, p_patch jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_session karaoke_sessions;
begin
  update karaoke_sessions set settings = settings || p_patch where id = p_session returning * into v_session;
  perform recompute_ranking(p_session);
end $$;

create or replace function new_session(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_settings jsonb;
begin
  update karaoke_sessions set status = 'CLOSED' where status = 'OPEN';
  select settings into v_settings from karaoke_sessions order by created_at desc limit 1;
  insert into karaoke_sessions (name, settings) values (p_name, coalesce(v_settings, '{}'::jsonb)) returning id into v_id;
  return v_id;
end $$;

-- -------------------------------------------------------------- search
create or replace function search_songs(p_query text, p_limit integer default 8)
returns setof songs language sql stable security definer set search_path = public as $$
  with q as (select lower(unaccent(p_query)) as text)
  select s.*
    from songs s, q
   where s.embeddable and s.status = 'ok'
     and (unaccent(s.search_text) % q.text
          or unaccent(s.search_text) ilike '%' || q.text || '%'
          or similarity(unaccent(s.search_text), q.text) > 0.15)
   order by (s.verified::int * 2 + s.favorite::int) desc,
            similarity(unaccent(s.search_text), q.text) desc
   limit p_limit
$$;

-- Functions are callable only by the server (service role keeps its grant).
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('selfies', 'selfies', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------- seed
insert into tables (number) select generate_series(1, 30) on conflict do nothing;

insert into karaoke_sessions (name, settings)
select 'Karaoke Night', jsonb_build_object(
  'etaBufferSec', 45, 'minVotesForRanking', 3, 'blockSameTableVote', false,
  'maxActiveRequestsPerDevice', 1, 'prepareNoticeSongs', 2, 'selfieRetentionHours', 24)
where not exists (select 1 from karaoke_sessions);

-- Demo catalog: public, embeddable videos so the players work before the
-- karaoke channel sync (development Step 4) fills the real catalog.
insert into songs (youtube_video_id, title, artist_guess, channel_title, duration_sec, verified, favorite) values
  ('kJQP7kiw5Fk', 'Despacito', 'Luis Fonsi ft. Daddy Yankee', 'Karaoke Latino', 282, true, false),
  ('NUsoVlDFqZg', 'Bailando', 'Enrique Iglesias', 'Karaoke Latino', 284, false, true),
  ('p47fEXGabaY', 'Livin'' la Vida Loca', 'Ricky Martin', 'Sing King Karaoke', 243, false, false),
  ('pRpeEdMmmQ0', 'Waka Waka', 'Shakira', 'KaraFun', 211, true, false),
  ('fJ9rUzIMcZQ', 'Bohemian Rhapsody', 'Queen', 'Sing King Karaoke', 359, true, false),
  ('dQw4w9WgXcQ', 'Never Gonna Give You Up', 'Rick Astley', 'Karaoke Version', 213, false, false),
  ('JGwWNGJdvx8', 'Shape of You', 'Ed Sheeran', 'Sing King Karaoke', 264, false, false),
  ('2Vv-BfVoq4g', 'Perfect', 'Ed Sheeran', 'KaraFun', 280, false, true),
  ('hTWKbfoikeg', 'Smells Like Teen Spirit', 'Nirvana', 'Stingray Karaoke', 279, false, false),
  ('OPf0YbXqDm0', 'Uptown Funk', 'Mark Ronson ft. Bruno Mars', 'Sing King Karaoke', 271, false, false),
  ('CevxZvSJLk8', 'Roar', 'Katy Perry', 'KaraFun', 270, false, false),
  ('YQHsXMglC9A', 'Hello', 'Adele', 'Zoom Karaoke', 367, false, false),
  ('60ItHLz5WEA', 'Faded', 'Alan Walker', 'Karaoke Version', 213, false, false),
  ('kXYiU_JCYtU', 'Numb', 'Linkin Park', 'Stingray Karaoke', 187, false, false),
  ('RgKAFK5djSk', 'See You Again', 'Wiz Khalifa ft. Charlie Puth', 'Sing King Karaoke', 238, false, false),
  ('9bZkp7q19f0', 'Gangnam Style', 'PSY', 'Zoom Karaoke', 253, false, false)
on conflict (youtube_video_id) do nothing;

-- To grant panel access, create the user in Authentication → Users, then:
-- insert into admin_users (id, role, display_name)
-- select id, 'OWNER', 'Nombre' from auth.users where email = 'correo@ejemplo.cl';
