import type {
  AuditEntry,
  CatalogStats,
  KaraokeRequest,
  KaraokeSession,
  Participant,
  Performance,
  RequestStatus,
  SessionSettings,
  SessionState,
  Song,
  Vote,
} from "@/lib/domain/types";
import { serviceClient } from "@/lib/supabase/server";
import { HttpError } from "./http";
import { tvKey } from "./tv";

export const DEFAULT_SETTINGS: SessionSettings = {
  etaBufferSec: 45,
  minVotesForRanking: 3,
  blockSameTableVote: false,
  maxActiveRequestsPerDevice: 1,
  prepareNoticeSongs: 2,
  selfieRetentionHours: 24,
  fallbackSearchCapPerNight: 60,
};

const SELFIE_URL_TTL_SEC = 60 * 60;

interface SessionRow {
  id: string;
  name: string;
  status: "OPEN" | "CLOSED";
  starts_at: string;
  ends_at: string;
  settings: Partial<SessionSettings>;
  queue_version: number;
}

const ms = (iso: string | null) => (iso ? Date.parse(iso) : null);

/** Maps a `songs` row (any column subset that includes these) to the client type. */
export function songFromRow(s: Record<string, unknown>): Song {
  return {
    id: s.id as string,
    youtubeVideoId: s.youtube_video_id as string,
    title: s.title as string,
    artistGuess: (s.artist_guess as string) ?? "",
    channelTitle: (s.channel_title as string) ?? "",
    durationSec: (s.duration_sec as number) ?? 0,
    embeddable: (s.embeddable as boolean) ?? true,
    verified: (s.verified as boolean) ?? false,
    favorite: (s.favorite as boolean) ?? false,
    categories: (s.categories as string[]) ?? [],
  };
}

export async function currentSession(): Promise<SessionRow> {
  const { data, error } = await serviceClient()
    .from("karaoke_sessions")
    .select("id,name,status,starts_at,ends_at,settings,queue_version")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(503, "No hay una noche configurada");
  return data as SessionRow;
}

export function settingsOf(row: SessionRow): SessionSettings {
  return { ...DEFAULT_SETTINGS, ...row.settings };
}

/**
 * Everything the screens need for one session, joined and sanitized for the
 * requesting device: other devices' identities are reduced to `mine` flags,
 * selfie paths become short-lived signed URLs, audit only for admins.
 */
export async function buildSnapshot(deviceId: string | null, admin: boolean): Promise<SessionState> {
  const db = serviceClient();
  const row = await currentSession();

  const { data: reqRows, error: reqErr } = await db
    .from("requests")
    .select("id,participant_id,song_id,status,queue_order,requested_at,approved_at,reject_reason")
    .eq("session_id", row.id);
  if (reqErr) throw reqErr;
  const reqs = reqRows ?? [];

  const participantIds = [...new Set(reqs.map((r) => r.participant_id))];
  const songIds = [...new Set(reqs.map((r) => r.song_id))];
  const requestIds = reqs.map((r) => r.id);

  const [parts, songs, perfs] = await Promise.all([
    participantIds.length
      ? db.from("participants").select("id,device_session_id,display_name,table_number,selfie_path").in("id", participantIds)
      : Promise.resolve({ data: [], error: null }),
    songIds.length
      ? db.from("songs").select("id,youtube_video_id,title,artist_guess,channel_title,duration_sec,embeddable,verified,favorite,categories").in("id", songIds)
      : Promise.resolve({ data: [], error: null }),
    requestIds.length
      ? db.from("performances").select("*").in("request_id", requestIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (parts.error) throw parts.error;
  if (songs.error) throw songs.error;
  if (perfs.error) throw perfs.error;

  const perfIds = (perfs.data ?? []).map((p) => p.id);
  const votesRes = perfIds.length
    ? await db.from("votes").select("id,performance_id,voter_device_session_id,stars,created_at").in("performance_id", perfIds)
    : { data: [], error: null };
  if (votesRes.error) throw votesRes.error;

  const selfiePaths = (parts.data ?? []).map((p) => p.selfie_path).filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (selfiePaths.length) {
    const { data } = await db.storage.from("selfies").createSignedUrls(selfiePaths, SELFIE_URL_TTL_SEC);
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
  }

  let audit: AuditEntry[] = [];
  let catalog: CatalogStats | null = null;
  if (admin) {
    const [{ data: stats }, { data: channelRows }] = await Promise.all([db.rpc("catalog_stats"), db.rpc("catalog_channel_list")]);
    const s = (stats ?? {}) as Record<string, unknown>;
    catalog = {
      songs: Number(s.songs ?? 0),
      channels: Number(s.channels ?? 0),
      channelList: ((channelRows ?? []) as Record<string, unknown>[]).map((c) => ({
        id: c.id as string,
        title: c.title as string,
        trusted: Boolean(c.trusted),
        note: (c.note as string | null) ?? null,
        songCount: Number(c.songCount ?? 0),
        backfillDone: Boolean(c.backfillDone),
        lastSyncAt: c.lastSyncAt ? Date.parse(c.lastSyncAt as string) : null,
      })),
      lastSyncAt: s.lastSyncAt ? Date.parse(s.lastSyncAt as string) : null,
      pendingQueries: Number(s.pendingQueries ?? 0),
      quotaUsedToday: Number(s.quotaUsedToday ?? 0),
      fallbackSearchesToday: Number(s.fallbackSearchesToday ?? 0),
      byCategory: (s.byCategory as Record<string, number>) ?? {},
    };
    const { data } = await db
      .from("audit_log")
      .select("id,created_at,action,entity_id,payload")
      .order("created_at", { ascending: false })
      .limit(40);
    audit = (data ?? []).map((a) => ({
      id: String(a.id),
      at: Date.parse(a.created_at),
      action: a.action,
      entityId: a.entity_id ?? "",
      detail: typeof a.payload?.detail === "string" ? a.payload.detail : undefined,
    }));
  }

  const session: KaraokeSession = {
    id: row.id,
    name: row.name,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  };

  const participants: Participant[] = (parts.data ?? []).map((p) => ({
    id: p.id,
    mine: p.device_session_id === deviceId,
    displayName: p.display_name,
    tableNumber: p.table_number,
    selfieUrl: p.selfie_path ? signed.get(p.selfie_path) ?? null : null,
  }));

  const songList: Song[] = (songs.data ?? []).map(songFromRow);

  const requests: KaraokeRequest[] = reqs.map((r) => ({
    id: r.id,
    participantId: r.participant_id,
    songId: r.song_id,
    status: r.status as RequestStatus,
    queueOrder: r.queue_order,
    requestedAt: Date.parse(r.requested_at),
    approvedAt: ms(r.approved_at),
    rejectReason: r.reject_reason,
  }));

  const performances: Performance[] = (perfs.data ?? []).map((p) => ({
    id: p.id,
    requestId: p.request_id,
    startedAt: Date.parse(p.started_at),
    endedAt: ms(p.ended_at),
    paused: p.paused,
    playerTime: Number(p.player_time),
    tickAt: Date.parse(p.tick_at),
    finalRating: p.final_rating === null ? null : Number(p.final_rating),
    voteCount: p.vote_count,
    rank: p.rank,
  }));

  const votes: Vote[] = (votesRes.data ?? []).map((v) => ({
    id: v.id,
    performanceId: v.performance_id,
    mine: v.voter_device_session_id === deviceId,
    stars: v.stars as Vote["stars"],
    createdAt: Date.parse(v.created_at),
  }));

  return {
    serverNow: Date.now(),
    session,
    settings: settingsOf(row),
    queueVersion: row.queue_version,
    songs: songList,
    participants,
    requests,
    performances,
    votes,
    audit,
    catalog,
    tvKey: admin ? tvKey() : null,
  };
}
