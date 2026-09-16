import type { NextRequest } from "next/server";
import { requireDevice } from "@/lib/server/device";
import { assert, handle, isUuid, json } from "@/lib/server/http";
import { broadcast } from "@/lib/server/realtime";
import { buildSnapshot, currentSession } from "@/lib/server/snapshot";
import { serviceClient } from "@/lib/supabase/server";

/** Guest cancels their own request while it is still waiting. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const deviceId = requireDevice(req);
    const { id } = await ctx.params;
    assert(isUuid(id), "Solicitud inválida");
    const { error } = await serviceClient().rpc("cancel_own_request", { p_request: id, p_device: deviceId });
    if (error) throw error;
    await broadcast((await currentSession()).id, "changed");
    return json(await buildSnapshot(deviceId, false));
  });
}
