-- Channels can be switched off with a reason; non-embeddable videos are not kept.
alter table catalog_channels add column if not exists note text;

update catalog_channels
   set trusted = false, note = 'Sus videos no permiten reproducción embebida'
 where title in ('Sing King', 'PISTAS PROFESIONALES');

delete from songs
 where status <> 'ok'
   and id not in (select song_id from requests union select replaced_song_id from requests where replaced_song_id is not null);

create or replace function catalog_channel_list()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', channel_id, 'title', title, 'trusted', trusted, 'note', note,
    'songCount', song_count, 'backfillDone', backfill_done,
    'lastSyncAt', last_synced_at) order by trusted desc, title), '[]'::jsonb)
  from catalog_channels
$$;

revoke execute on function catalog_channel_list() from public, anon, authenticated;
