import type { NextRequest } from "next/server";
import type { Song } from "@/lib/domain/types";
import { handle, json } from "@/lib/server/http";
import { currentSession, settingsOf, songFromRow } from "@/lib/server/snapshot";
import { serviceClient } from "@/lib/supabase/server";
import { fallbackSearch } from "@/lib/youtube/catalog";
import { normalizeQuery } from "@/lib/youtube/categories";

export const dynamic = "force-dynamic";

const MIN_LOCAL_HITS = 3;

/**
 * Catalog first (zero quota), then the cached or budgeted YouTube fallback.
 * The fallback never runs for queries the catalog already answers well.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
    if (q.length < 3) return json<Song[]>([]);
    const db = serviceClient();
    const { data, error } = await db.rpc("search_songs", { p_query: q, p_limit: 8 });
    if (error) throw error;
    let songs: Song[] = (data ?? []).map(songFromRow);

    if (songs.length < MIN_LOCAL_HITS && process.env.YOUTUBE_API_KEY) {
      const session = await currentSession();
      const ids = await fallbackSearch(q, normalizeQuery(q), settingsOf(session).fallbackSearchCapPerNight).catch((e) => {
        console.error("fallback search", e);
        return null;
      });
      if (ids && ids.length) {
        const { data: rows } = await db.from("songs").select("*").in("youtube_video_id", ids).eq("status", "ok");
        const byId = new Map((rows ?? []).map((r) => [r.youtube_video_id as string, songFromRow(r)]));
        const extra = ids.map((id) => byId.get(id)).filter((s): s is Song => !!s && !songs.some((x) => x.id === s.id));
        songs = [...songs, ...extra].slice(0, 8);
      }
    }
    return json(songs, { headers: { "Cache-Control": "private, max-age=30" } });
  });
}
