-- Channel song counts computed live (playable songs only), so deactivated
-- channels whose videos were removed no longer show stale numbers.
create or replace function catalog_channel_list()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.channel_id, 'title', c.title, 'trusted', c.trusted, 'note', c.note,
    'songCount', (select count(*) from songs s where s.channel_id = c.channel_id and s.status = 'ok'),
    'backfillDone', c.backfill_done,
    'lastSyncAt', c.last_synced_at) order by c.trusted desc, c.title), '[]'::jsonb)
  from catalog_channels c
$$;

revoke execute on function catalog_channel_list() from public, anon, authenticated;
