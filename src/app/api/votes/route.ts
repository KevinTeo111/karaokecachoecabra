import type { NextRequest } from "next/server";
import { requireDevice } from "@/lib/server/device";
import { assert, handle, isUuid, json, readJson } from "@/lib/server/http";
import { broadcast } from "@/lib/server/realtime";
import { buildSnapshot, currentSession } from "@/lib/server/snapshot";
import { serviceClient } from "@/lib/supabase/server";

/** One vote per device per performance; no self-vote. Enforced in `cast_vote`. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const deviceId = requireDevice(req);
    const body = await readJson<{ performanceId: string; stars: number }>(req);
    assert(isUuid(body.performanceId), "Presentación inválida");
    assert(Number.isInteger(body.stars) && body.stars >= 1 && body.stars <= 5, "Las estrellas van de 1 a 5");
    const { error } = await serviceClient().rpc("cast_vote", {
      p_performance: body.performanceId,
      p_device: deviceId,
      p_stars: body.stars,
    });
    if (error) throw error;
    await broadcast((await currentSession()).id, "changed");
    return json(await buildSnapshot(deviceId, false));
  });
}
