-- Let the next sync runs re-parse titles imported before the channel-aware split.
update songs set last_checked_at = null where source = 'catalog';
