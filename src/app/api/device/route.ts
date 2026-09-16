import type { NextRequest } from "next/server";
import { resolveDevice, setDeviceCookie } from "@/lib/server/device";
import { handle, json, readJson } from "@/lib/server/http";
import { serviceClient } from "@/lib/supabase/server";

/** Registers (or refreshes) this browser's anonymous device identity. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await readJson<{ table?: number | null }>(req).catch(() => ({}) as { table?: number | null });
    const table = Number.isInteger(body.table) && body.table! >= 1 && body.table! <= 999 ? body.table : null;
    const { id, isNew } = resolveDevice(req);
    const { error } = await serviceClient().rpc("touch_device", { p_device: id, p_table: table });
    if (error) throw error;
    const res = json({ deviceId: id });
    if (isNew) setDeviceCookie(res, id);
    return res;
  });
}
