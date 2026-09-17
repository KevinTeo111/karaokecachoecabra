import type { NextRequest } from "next/server";
import type { Song } from "@/lib/domain/types";
import { handle, json } from "@/lib/server/http";
import { songFromRow } from "@/lib/server/snapshot";
import { serviceClient } from "@/lib/supabase/server";
import { isCategory } from "@/lib/youtube/categories";

export const dynamic = "force-dynamic";

/** Catalog browsing by category chip. Zero quota. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const category = req.nextUrl.searchParams.get("category") ?? "";
    const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") ?? 0) || 0);
    if (!isCategory(category)) return json<Song[]>([]);
    const { data, error } = await serviceClient().rpc("browse_songs", { p_category: category, p_limit: 24, p_offset: offset });
    if (error) throw error;
    return json((data ?? []).map(songFromRow), { headers: { "Cache-Control": "private, max-age=60" } });
  });
}
