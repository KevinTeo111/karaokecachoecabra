import type { NextRequest } from "next/server";
import { assert, handle, isUuid, json, readJson } from "@/lib/server/http";
import { broadcast } from "@/lib/server/realtime";
import { currentSession } from "@/lib/server/snapshot";
import { requireTvKey } from "@/lib/server/tv";
import { serviceClient } from "@/lib/supabase/server";

/**
 * The stage video reached its end: close votes and publish the result, so the
 * TV shows the score and the next singer and the host only has to press Iniciar.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    assert(isUuid(id), "Presentación inválida");
    const body = await readJson<{ tvKey?: string }>(req).catch(() => ({}) as { tvKey?: string });
    requireTvKey(body.tvKey);
    const db = serviceClient();
    const { data: perf } = await db.from("performances").select("id,ended_at").eq("id", id).maybeSingle();
    if (!perf) return json({ ok: false }, { status: 404 });
    if (perf.ended_at) return json({ ok: true, already: true });
    const { error } = await db.rpc("finish_performance", { p_performance: id });
    if (error) throw error;
    await db.from("audit_log").insert({ action: "performance/autofinish", entity_type: "performance", entity_id: id, payload: { detail: "fin del video" } });
    await broadcast((await currentSession()).id, "changed");
    return json({ ok: true });
  });
}
