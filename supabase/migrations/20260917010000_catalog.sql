-- Catalog sources, categories, quota ledger, browse and health-check support.

alter table songs
  add column if not exists categories     text[] not null default '{}',
  add column if not exists published_at   timestamptz,
  add column if not exists view_count     bigint,
  add column if not exists channel_id     text,
  add column if not exists last_checked_at timestamptz;
create index if not exists songs_categories on songs using gin (categories);
create index if not exists songs_channel on songs (channel_id);

-- Karaoke channels whose uploads feed the catalog.
create table if not exists catalog_channels (
  channel_id          text primary key,
  title               text not null,
  uploads_playlist_id text not null,
  trusted             boolean not null default true,
  last_synced_at      timestamptz,
  last_published_at   timestamptz,
  song_count          integer not null default 0
);
alter table catalog_channels enable row level security;

-- One-time genre searches that seed each category the venue asked for.
create table if not exists catalog_queries (
  query       text primary key,
  category    text not null,
  last_run_at timestamptz,
  result_count integer
);
alter table catalog_queries enable row level security;

-- YouTube Data API quota, one row per Pacific-time day (the reset boundary).
create table if not exists api_quota_ledger (
  day        date primary key,
  units_used integer not null default 0,
  calls      jsonb not null default '{}'::jsonb
);
alter table api_quota_ledger enable row level security;

create or replace function quota_day() returns date language sql stable as $$
  select (now() at time zone 'America/Los_Angeles')::date
$$;

create or replace function add_quota(p_units integer, p_label text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_total integer;
begin
  insert into api_quota_ledger (day, units_used, calls)
  values (quota_day(), p_units, jsonb_build_object(p_label, p_units))
  on conflict (day) do update
    set units_used = api_quota_ledger.units_used + excluded.units_used,
        calls = api_quota_ledger.calls ||
                jsonb_build_object(p_label, coalesce((api_quota_ledger.calls ->> p_label)::integer, 0) + p_units)
  returning units_used into v_total;
  return v_total;
end $$;

create or replace function quota_used_today() returns integer language sql stable security definer set search_path = public as $$
  select coalesce((select units_used from api_quota_ledger where day = quota_day()), 0)
$$;

-- Fallback searches performed today (each costs 100 units), for the nightly cap.
create or replace function fallback_searches_today() returns integer language sql stable security definer set search_path = public as $$
  select coalesce((select (calls ->> 'search')::integer from api_quota_ledger where day = quota_day()), 0) / 100
$$;

create or replace function search_songs(p_query text, p_limit integer default 8)
returns setof songs language sql stable security definer set search_path = public as $$
  with q as (select lower(unaccent(p_query)) as text)
  select s.*
    from songs s, q
   where s.embeddable and s.status = 'ok'
     and (unaccent(s.search_text) ilike '%' || q.text || '%'
          or word_similarity(q.text, unaccent(s.search_text)) >= 0.45)
   order by (s.verified::int * 2 + s.favorite::int) desc,
            (unaccent(s.search_text) ilike '%' || q.text || '%') desc,
            word_similarity(q.text, unaccent(s.search_text)) desc,
            s.view_count desc nulls last
   limit p_limit
$$;

create or replace function browse_songs(p_category text, p_limit integer default 24, p_offset integer default 0)
returns setof songs language sql stable security definer set search_path = public as $$
  select s.* from songs s
   where s.embeddable and s.status = 'ok' and p_category = any (s.categories)
   order by s.verified desc, s.favorite desc, s.view_count desc nulls last, s.title
   limit p_limit offset p_offset
$$;

create or replace function catalog_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'songs', (select count(*) from songs where status = 'ok'),
    'channels', (select count(*) from catalog_channels where trusted),
    'lastSyncAt', (select max(last_synced_at) from catalog_channels),
    'pendingQueries', (select count(*) from catalog_queries where last_run_at is null),
    'quotaUsedToday', quota_used_today(),
    'fallbackSearchesToday', fallback_searches_today(),
    'byCategory', (select coalesce(jsonb_object_agg(c, n), '{}'::jsonb) from
      (select unnest(categories) c, count(*) n from songs where status = 'ok' group by 1) x)
  )
$$;

revoke execute on all functions in schema public from public, anon, authenticated;

-- Default seed sources. Channel ids are resolved from handles on first sync.
insert into catalog_queries (query, category) values
  ('boleros karaoke con letra', 'boleros'),
  ('karaoke bolero trío', 'boleros'),
  ('los panchos karaoke', 'boleros'),
  ('baladas románticas karaoke en español', 'romanticas'),
  ('canciones de amor karaoke con letra', 'romanticas'),
  ('karaoke romántico éxitos', 'romanticas'),
  ('karaoke éxitos años 80 en español', '80s'),
  ('80s hits karaoke lyrics', '80s'),
  ('rock latino años 80 karaoke', '80s'),
  ('karaoke éxitos años 90 en español', '90s'),
  ('90s hits karaoke lyrics', '90s'),
  ('pop latino años 90 karaoke', '90s'),
  ('karaoke éxitos 2000 en español', '2000s'),
  ('2000s hits karaoke lyrics', '2000s'),
  ('karaoke latino éxitos con letra', 'latinas'),
  ('cumbia karaoke con letra', 'latinas'),
  ('salsa karaoke con letra', 'latinas'),
  ('reggaeton karaoke con letra', 'latinas'),
  ('rock en español karaoke con letra', 'rock'),
  ('classic rock karaoke lyrics', 'rock')
on conflict (query) do nothing;
