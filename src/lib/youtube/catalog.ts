import { serviceClient } from "@/lib/supabase/server";
import {
  channelInfo,
  DAILY_QUOTA,
  playlistPage,
  quotaUsedToday,
  QUOTA,
  searchList,
  videosList,
  YouTubeError,
  type VideoDetails,
} from "./api";
import { CATEGORIES, DEFAULT_CHANNELS, guessCategories, karaokeScore, splitTitle, type CategorySlug } from "./categories";

/** Stop background work when the day's quota reaches this; the night keeps the rest. */
const SYNC_QUOTA_CEILING = 7_000;
const HEALTH_CHECK_DAYS = 7;

export interface SyncReport {
  channels: { id: string; title: string; added: number; pages: number }[];
  queries: { query: string; category: string; added: number }[];
  healthChecked: number;
  quotaUsed: number;
  stoppedReason: string | null;
}

interface SongUpsert {
  youtube_video_id: string;
  title: string;
  artist_guess: string;
  channel_title: string;
  channel_id: string;
  duration_sec: number;
  embeddable: boolean;
  status: "ok" | "unavailable" | "not_embeddable";
  source: "catalog" | "search" | "host";
  published_at: string | null;
  view_count: number | null;
  last_checked_at: string;
}

function toRow(v: VideoDetails, source: SongUpsert["source"]): SongUpsert {
  const { title, artist } = splitTitle(v.title, v.channelTitle);
  return {
    youtube_video_id: v.id,
    title,
    artist_guess: artist,
    channel_title: v.channelTitle,
    channel_id: v.channelId,
    duration_sec: v.durationSec,
    embeddable: v.embeddable,
    status: !v.available ? "unavailable" : !v.embeddable ? "not_embeddable" : "ok",
    source,
    published_at: v.publishedAt || null,
    view_count: v.viewCount,
    last_checked_at: new Date().toISOString(),
  };
}

/** Inserts new songs, refreshes existing ones, and merges categories. Returns how many were new. */
export async function upsertSongs(
  details: VideoDetails[],
  source: SongUpsert["source"],
  extraCategories: CategorySlug[] = [],
): Promise<number> {
  const db = serviceClient();
  // Only public, embeddable videos are worth keeping: anything else can never play on stage.
  const usable = details.filter((d) => d.available && d.embeddable && d.title);
  if (usable.length === 0) return 0;
  const ids = usable.map((d) => d.id);
  const { data: existing } = await db.from("songs").select("youtube_video_id,categories,source").in("youtube_video_id", ids);
  const known = new Map(
    (existing ?? []).map((e) => [e.youtube_video_id as string, { categories: e.categories as string[], source: e.source as SongUpsert["source"] }]),
  );

  // Existing songs keep their original source; categories are merged.
  const rows = usable.map((d) => {
    const prev = known.get(d.id);
    const cats = new Set<string>([...(prev?.categories ?? []), ...guessCategories(d.title), ...extraCategories]);
    return { ...toRow(d, prev?.source ?? source), categories: [...cats] };
  });
  const { error } = await db.from("songs").upsert(rows, { onConflict: "youtube_video_id" });
  if (error) throw error;
  return rows.filter((r) => !known.has(r.youtube_video_id)).length;
}

async function budgetLeft(): Promise<number> {
  return SYNC_QUOTA_CEILING - (await quotaUsedToday());
}

/** Registers a channel by handle or id, or refreshes its title. 1 unit. */
export async function addChannel(ref: string) {
  const info = await channelInfo(ref);
  if (!info) throw new YouTubeError("Canal no encontrado");
  const { error } = await serviceClient()
    .from("catalog_channels")
    .upsert({ channel_id: info.id, title: info.title, uploads_playlist_id: info.uploadsPlaylistId }, { onConflict: "channel_id" });
  if (error) throw error;
  return info;
}

interface ChannelRow {
  channel_id: string;
  title: string;
  uploads_playlist_id: string;
  last_published_at: string | null;
  backfill_page_token: string | null;
  backfill_done: boolean;
}

/** Pages per channel per run, so one huge channel cannot starve the others. */
const MAX_PAGES_PER_RUN = 30;

/**
 * Imports a channel's uploads. The first pass ("backfill") walks the whole
 * playlist and can span several runs by saving its page token. After that,
 * each run reads newest-first and stops at videos published before the
 * last sync. Both modes stop at the deadline and the quota ceiling.
 */
async function syncChannel(ch: ChannelRow, deadline: number) {
  const db = serviceClient();
  let pageToken: string | undefined = ch.backfill_done ? undefined : (ch.backfill_page_token ?? undefined);
  let added = 0;
  let pages = 0;
  let newest: string | null = ch.last_published_at;
  const stopBefore = ch.backfill_done && ch.last_published_at ? Date.parse(ch.last_published_at) : 0;
  let finished = false;

  while (pages < MAX_PAGES_PER_RUN && Date.now() < deadline && (await budgetLeft()) >= 60) {
    const page = await playlistPage(ch.uploads_playlist_id, pageToken);
    pages += 1;
    const fresh = page.items.filter((i) => !i.publishedAt || Date.parse(i.publishedAt) > stopBefore);
    for (const i of fresh) if (i.publishedAt && (!newest || i.publishedAt > newest)) newest = i.publishedAt;
    if (fresh.length > 0) {
      const details = await videosList(fresh.map((i) => i.videoId));
      // A channel that blocks embedding is useless for the stage: switch it off instead of paging on.
      if (pages === 1 && details.length >= 10 && !details.some((d) => d.available && d.embeddable)) {
        await db
          .from("catalog_channels")
          .update({ trusted: false, note: "Sus videos no permiten reproducción embebida", last_synced_at: new Date().toISOString() })
          .eq("channel_id", ch.channel_id);
        return { id: ch.channel_id, title: ch.title, added: 0, pages };
      }
      const karaokeOnly = details.filter((d) => karaokeScore(d.title, d.channelTitle, d.durationSec) > -6);
      added += await upsertSongs(karaokeOnly, "catalog");
    }
    const reachedOld = fresh.length < page.items.length;
    if (!page.next || reachedOld) {
      finished = true;
      pageToken = undefined;
      break;
    }
    pageToken = page.next;
  }

  await db
    .from("catalog_channels")
    .update({
      last_synced_at: new Date().toISOString(),
      last_published_at: newest,
      backfill_page_token: ch.backfill_done ? null : finished ? null : (pageToken ?? null),
      backfill_done: ch.backfill_done || finished,
    })
    .eq("channel_id", ch.channel_id);
  const { count } = await db.from("songs").select("id", { count: "exact", head: true }).eq("channel_id", ch.channel_id);
  await db.from("catalog_channels").update({ song_count: count ?? 0 }).eq("channel_id", ch.channel_id);
  return { id: ch.channel_id, title: ch.title, added, pages };
}

/** Runs one pending genre query: 100 units for the search plus 1 per 50 details. */
async function runSeedQuery(q: { query: string; category: string }) {
  const db = serviceClient();
  const results = await searchList(q.query, 50, "seed");
  // The expensive call is done: mark the query as run now so a later failure never repeats it.
  await db.from("catalog_queries").update({ last_run_at: new Date().toISOString() }).eq("query", q.query);
  const details = await videosList(results.map((r) => r.id));
  const karaokeOnly = details.filter((d) => karaokeScore(d.title, d.channelTitle, d.durationSec) >= 0);
  const added = await upsertSongs(karaokeOnly, "catalog", [q.category as CategorySlug]);
  await db.from("catalog_queries").update({ result_count: karaokeOnly.length }).eq("query", q.query);
  return { query: q.query, category: q.category, added };
}

/** Re-checks songs not verified in a week; marks removed or non-embeddable ones. */
async function healthCheck(): Promise<number> {
  const db = serviceClient();
  const cutoff = new Date(Date.now() - HEALTH_CHECK_DAYS * 86_400_000).toISOString();
  const { data } = await db
    .from("songs")
    .select("youtube_video_id")
    .or(`last_checked_at.is.null,last_checked_at.lt.${cutoff}`)
    .limit(200);
  const ids = (data ?? []).map((s) => s.youtube_video_id as string);
  if (ids.length === 0 || (await budgetLeft()) < 20) return 0;
  const details = await videosList(ids);
  for (const d of details) {
    const parsed = d.available ? splitTitle(d.title, d.channelTitle) : null;
    await db
      .from("songs")
      .update({
        ...(parsed ? { title: parsed.title, artist_guess: parsed.artist } : {}),
        embeddable: d.embeddable,
        status: !d.available ? "unavailable" : !d.embeddable ? "not_embeddable" : "ok",
        last_checked_at: new Date().toISOString(),
        ...(d.viewCount !== null ? { view_count: d.viewCount } : {}),
      })
      .eq("youtube_video_id", d.id);
  }
  return details.length;
}

/**
 * One maintenance run: register default channels, sync channel uploads,
 * run pending category queries, health-check stale songs. Bounded by
 * `maxMs` and by the quota ceiling; safe to call repeatedly (idempotent).
 */
export async function runCatalogSync(maxMs = 50_000): Promise<SyncReport> {
  const db = serviceClient();
  const started = Date.now();
  const before = await quotaUsedToday();
  const report: SyncReport = { channels: [], queries: [], healthChecked: 0, quotaUsed: 0, stoppedReason: null };
  const timeLeft = () => maxMs - (Date.now() - started);

  try {
    const { data: known } = await db.from("catalog_channels").select("channel_id");
    if ((known ?? []).length === 0) {
      for (const ref of DEFAULT_CHANNELS) {
        try {
          await addChannel(ref);
        } catch (e) {
          console.warn("channel", ref, (e as Error).message);
        }
      }
    }

    const { data: queries } = await db.from("catalog_queries").select("query,category").is("last_run_at", null);
    for (const q of queries ?? []) {
      if (timeLeft() < 8_000 || (await budgetLeft()) < QUOTA.search + 10) {
        report.stoppedReason = timeLeft() < 8_000 ? "tiempo" : "cuota";
        break;
      }
      report.queries.push(await runSeedQuery(q));
    }

    const { data: channels } = await db
      .from("catalog_channels")
      .select("channel_id,title,uploads_playlist_id,last_published_at,backfill_page_token,backfill_done")
      .eq("trusted", true)
      .order("backfill_done", { ascending: true })
      .order("last_synced_at", { ascending: true, nullsFirst: true });
    const deadline = started + maxMs - 6_000;
    for (const ch of (channels ?? []) as ChannelRow[]) {
      if (timeLeft() < 8_000 || (await budgetLeft()) < 60) {
        report.stoppedReason = timeLeft() < 8_000 ? "tiempo" : "cuota";
        break;
      }
      report.channels.push(await syncChannel(ch, deadline));
    }

    if (timeLeft() > 5_000) report.healthChecked = await healthCheck();
  } catch (e) {
    report.stoppedReason = e instanceof YouTubeError && e.quotaExceeded ? "cuota agotada en YouTube" : (e as Error).message;
  }

  report.quotaUsed = (await quotaUsedToday()) - before;
  return report;
}

/**
 * Search fallback: called only when the catalog has fewer than 3 hits.
 * Cache first (30 days), then a budgeted `search.list`. Results are scored
 * for karaoke intent, stored in the catalog, and cached by normalized query.
 */
export async function fallbackSearch(query: string, normalized: string, capPerNight: number) {
  const db = serviceClient();
  const { data: cached } = await db
    .from("youtube_search_cache")
    .select("results,expires_at")
    .eq("normalized_query", normalized)
    .maybeSingle();
  if (cached && Date.parse(cached.expires_at) > Date.now()) return cached.results as string[];

  const { data: used } = await db.rpc("fallback_searches_today");
  if ((used as number) >= capPerNight || (await quotaUsedToday()) + QUOTA.search > DAILY_QUOTA - 200) return null;

  const results = await searchList(`${query} karaoke`, 25);
  const details = await videosList(results.map((r) => r.id));
  const ranked = details
    .map((d) => ({ d, score: karaokeScore(d.title, d.channelTitle, d.durationSec) }))
    .filter((x) => x.score >= 0 && x.d.available && x.d.embeddable)
    .sort((a, b) => b.score - a.score || (b.d.viewCount ?? 0) - (a.d.viewCount ?? 0))
    .slice(0, 8)
    .map((x) => x.d);
  await upsertSongs(ranked, "search");
  const ids = ranked.map((d) => d.id);
  await db.from("youtube_search_cache").upsert({
    normalized_query: normalized,
    results: ids,
    expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  });
  return ids;
}

export { CATEGORIES };
