import type { NextRequest } from "next/server";
import { assert, handle, isUuid, json, readJson } from "@/lib/server/http";
import { broadcast } from "@/lib/server/realtime";
import { currentSession } from "@/lib/server/snapshot";
import { serviceClient } from "@/lib/supabase/server";

/**
 * The stage TV reports its player position every few seconds. Stored for
 * ETA and reload recovery, and rebroadcast so singer phones correct drift.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    assert(isUuid(id), "Presentación inválida");
    const body = await readJson<{ playerTime: number }>(req);
    assert(Number.isFinite(body.playerTime) && body.playerTime >= 0 && body.playerTime < 36_000, "Tiempo inválido");
    const { error } = await serviceClient().rpc("tick_performance", { p_performance: id, p_time: body.playerTime });
    if (error) throw error;
    const at = Date.now();
    await broadcast((await currentSession()).id, "tick", { performanceId: id, playerTime: body.playerTime, at });
    return json({ ok: true, at });
  });
}
