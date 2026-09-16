import type { NextRequest } from "next/server";
import type { Song } from "@/lib/domain/types";
import { handle, json } from "@/lib/server/http";
import { serviceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Catalog search. The YouTube fallback and quota ledger arrive in Step 4. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
    if (q.length < 3) return json<Song[]>([]);
    const { data, error } = await serviceClient().rpc("search_songs", { p_query: q, p_limit: 8 });
    if (error) throw error;
    const songs: Song[] = (data ?? []).map((s: Record<string, unknown>) => ({
      id: s.id as string,
      youtubeVideoId: s.youtube_video_id as string,
      title: s.title as string,
      artistGuess: s.artist_guess as string,
      channelTitle: s.channel_title as string,
      durationSec: s.duration_sec as number,
      embeddable: s.embeddable as boolean,
      verified: s.verified as boolean,
      favorite: s.favorite as boolean,
    }));
    return json(songs, { headers: { "Cache-Control": "private, max-age=30" } });
  });
}
