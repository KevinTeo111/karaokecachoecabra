import type { NextRequest } from "next/server";
import { deviceFromCookie } from "@/lib/server/device";
import { handle, json } from "@/lib/server/http";
import { buildSnapshot } from "@/lib/server/snapshot";
import { currentAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Full state for this device. Used on load and as the polling fallback. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const deviceId = deviceFromCookie(req);
    const admin = await currentAdmin();
    return json(await buildSnapshot(deviceId, admin !== null), { headers: { "Cache-Control": "no-store" } });
  });
}
