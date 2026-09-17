-- Resumable channel import: a first full backfill can span several runs.
alter table catalog_channels
  add column if not exists backfill_page_token text,
  add column if not exists backfill_done boolean not null default false;
