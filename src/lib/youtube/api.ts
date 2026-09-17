import { serviceClient } from "@/lib/supabase/server";

/**
 * Thin YouTube Data API v3 client. Every call records its quota cost in
 * `api_quota_ledger` so the panel can show the budget and the search fallback
 * can stop before the daily limit.
 */
const BASE = "https://www.googleapis.com/youtube/v3";

export const QUOTA = { search: 100, videos: 1, playlistItems: 1, channels: 1 } as const;
export const DAILY_QUOTA = 10_000;

export class YouTubeError extends Error {
  constructor(
    message: string,
    public readonly quotaExceeded = false,
  ) {
    super(message);
  }
}

function key() {
  const k = process.env.YOUTUBE_API_KEY;
  if (!k) throw new YouTubeError("YOUTUBE_API_KEY no configurada");
  return k;
}

export type QuotaLabel = keyof typeof QUOTA | "seed";

export async function spendQuota(units: number, label: QuotaLabel) {
  const { data, error } = await serviceClient().rpc("add_quota", { p_units: units, p_label: label });
  if (error) console.error("quota ledger", error);
  return (data as number | null) ?? 0;
}

export async function quotaUsedToday(): Promise<number> {
  const { data } = await serviceClient().rpc("quota_used_today");
  return (data as number | null) ?? 0;
}

async function call<T>(resource: keyof typeof QUOTA, params: Record<string, string>, label: QuotaLabel = resource): Promise<T> {
  const url = new URL(`${BASE}/${resource}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key());
  const res = await fetch(url, { cache: "no-store" });
  await spendQuota(QUOTA[resource], label);
  const body = (await res.json()) as T & { error?: { message?: string; errors?: { reason?: string }[] } };
  if (!res.ok || body.error) {
    const reason = body.error?.errors?.[0]?.reason ?? "";
    throw new YouTubeError(body.error?.message ?? `YouTube ${res.status}`, reason === "quotaExceeded");
  }
  return body;
}

export interface VideoDetails {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  durationSec: number;
  embeddable: boolean;
  available: boolean;
  viewCount: number | null;
}

interface VideosResponse {
  items: {
    id: string;
    snippet: { title: string; channelId: string; channelTitle: string; publishedAt: string };
    contentDetails: { duration: string };
    status: { embeddable: boolean; privacyStatus: string; uploadStatus: string };
    statistics?: { viewCount?: string };
  }[];
}

/** Up to 50 ids per call, 1 unit. Ids missing from the answer are removed/private. */
export async function videosList(ids: string[]): Promise<VideoDetails[]> {
  if (ids.length === 0) return [];
  const out: VideoDetails[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const body = await call<VideosResponse>("videos", {
      part: "snippet,contentDetails,status,statistics",
      id: chunk.join(","),
      maxResults: "50",
    });
    const seen = new Set<string>();
    for (const v of body.items) {
      seen.add(v.id);
      out.push({
        id: v.id,
        title: v.snippet.title,
        channelId: v.snippet.channelId,
        channelTitle: v.snippet.channelTitle,
        publishedAt: v.snippet.publishedAt,
        durationSec: parseIsoDuration(v.contentDetails.duration),
        embeddable: v.status.embeddable,
        available: v.status.privacyStatus === "public" && v.status.uploadStatus === "processed",
        viewCount: v.statistics?.viewCount ? Number(v.statistics.viewCount) : null,
      });
    }
    for (const id of chunk) {
      if (!seen.has(id)) {
        out.push({
          id,
          title: "",
          channelId: "",
          channelTitle: "",
          publishedAt: "",
          durationSec: 0,
          embeddable: false,
          available: false,
          viewCount: null,
        });
      }
    }
  }
  return out;
}

interface SearchResponse {
  items: { id: { videoId?: string }; snippet: { title: string; channelId: string; channelTitle: string } }[];
}

/**
 * 100 units. Embeddable public videos only, Spanish relevance, Chile region.
 * Label "seed" keeps one-time catalog seeding out of the nightly fallback count.
 */
export async function searchList(q: string, maxResults = 25, label: QuotaLabel = "search") {
  const body = await call<SearchResponse>("search", {
    part: "snippet",
    type: "video",
    q,
    maxResults: String(Math.min(50, maxResults)),
    videoEmbeddable: "true",
    videoSyndicated: "true",
    relevanceLanguage: "es",
    regionCode: "CL",
    safeSearch: "moderate",
  }, label);
  return body.items
    .filter((i) => i.id.videoId)
    .map((i) => ({ id: i.id.videoId!, title: i.snippet.title, channelId: i.snippet.channelId, channelTitle: i.snippet.channelTitle }));
}

interface ChannelsResponse {
  items?: { id: string; snippet: { title: string }; contentDetails: { relatedPlaylists: { uploads: string } } }[];
}

/** Resolves a channel by @handle or id, 1 unit. */
export async function channelInfo(ref: string) {
  const params: Record<string, string> = ref.startsWith("@") ? { forHandle: ref } : { id: ref };
  const body = await call<ChannelsResponse>("channels", { part: "snippet,contentDetails", ...params });
  const c = body.items?.[0];
  return c ? { id: c.id, title: c.snippet.title, uploadsPlaylistId: c.contentDetails.relatedPlaylists.uploads } : null;
}

interface PlaylistItemsResponse {
  nextPageToken?: string;
  items: { contentDetails: { videoId: string; videoPublishedAt?: string } }[];
}

/** One page of a playlist (50 items), 1 unit. */
export async function playlistPage(playlistId: string, pageToken?: string) {
  const body = await call<PlaylistItemsResponse>("playlistItems", {
    part: "contentDetails",
    playlistId,
    maxResults: "50",
    ...(pageToken ? { pageToken } : {}),
  });
  return {
    next: body.nextPageToken,
    items: body.items.map((i) => ({ videoId: i.contentDetails.videoId, publishedAt: i.contentDetails.videoPublishedAt ?? null })),
  };
}

export function parseIsoDuration(iso: string): number {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export function parseVideoId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname === "youtu.be") return u.pathname.slice(1, 12) || null;
    if (u.hostname.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v.slice(0, 11);
      const m = /\/(?:shorts|embed|live)\/([\w-]{11})/.exec(u.pathname);
      if (m) return m[1];
    }
  } catch {
    /* not a url */
  }
  return null;
}
