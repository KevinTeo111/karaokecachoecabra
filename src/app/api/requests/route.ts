import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireDevice } from "@/lib/server/device";
import { assert, handle, HttpError, isUuid, json, readJson } from "@/lib/server/http";
import { broadcast } from "@/lib/server/realtime";
import { buildSnapshot, currentSession, settingsOf } from "@/lib/server/snapshot";
import { serviceClient } from "@/lib/supabase/server";

interface Body {
  songId: string;
  displayName: string;
  tableNumber: number;
  selfieDataUrl: string;
}

const MAX_SELFIE_BYTES = 1_500_000;

/** Guest creates a PENDING request with a framed selfie. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const deviceId = requireDevice(req);
    const body = await readJson<Body>(req);
    const name = String(body.displayName ?? "").trim();
    assert(isUuid(body.songId), "Canción inválida");
    assert(name.length >= 2 && name.length <= 24, "El nombre debe tener entre 2 y 24 caracteres");
    assert(Number.isInteger(body.tableNumber) && body.tableNumber >= 1 && body.tableNumber <= 999, "Mesa inválida");
    const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(body.selfieDataUrl ?? "");
    assert(match, "La selfie es obligatoria");
    const bytes = Buffer.from(match[1], "base64");
    assert(bytes.byteLength > 1_000 && bytes.byteLength <= MAX_SELFIE_BYTES, "Selfie demasiado grande");

    const db = serviceClient();
    const session = await currentSession();
    if (session.status !== "OPEN") throw new HttpError(409, "El karaoke está cerrado");

    const path = `${session.id}/${deviceId}/${randomUUID()}.jpg`;
    const up = await db.storage.from("selfies").upload(path, bytes, { contentType: "image/jpeg", upsert: false });
    if (up.error) throw new HttpError(500, "No se pudo guardar la selfie");

    const { error } = await db.rpc("create_request", {
      p_session: session.id,
      p_device: deviceId,
      p_song: body.songId,
      p_name: name,
      p_table: body.tableNumber,
      p_selfie_path: path,
      p_retention_hours: settingsOf(session).selfieRetentionHours,
    });
    if (error) {
      await db.storage.from("selfies").remove([path]);
      throw error;
    }
    await broadcast(session.id, "changed");
    return json(await buildSnapshot(deviceId, false));
  });
}
