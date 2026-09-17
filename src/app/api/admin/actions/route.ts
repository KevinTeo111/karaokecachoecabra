import type { NextRequest } from "next/server";
import { deviceFromCookie } from "@/lib/server/device";
import { assert, handle, HttpError, isUuid, json, readJson } from "@/lib/server/http";
import { broadcast } from "@/lib/server/realtime";
import { buildSnapshot, currentSession } from "@/lib/server/snapshot";
import { requireAdmin, serviceClient } from "@/lib/supabase/server";
import { ADMIN_ACTION_TYPES, type AdminAction } from "@/lib/store/actions";
import { parseVideoId, videosList } from "@/lib/youtube/api";
import { addChannel, runCatalogSync, upsertSongs } from "@/lib/youtube/catalog";

export const maxDuration = 60;

const SETTING_KEYS = new Set([
  "etaBufferSec",
  "minVotesForRanking",
  "blockSameTableVote",
  "maxActiveRequestsPerDevice",
  "prepareNoticeSongs",
  "selfieRetentionHours",
  "fallbackSearchCapPerNight",
]);

/** Single entry point for every animador action. Audited and broadcast. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const admin = await requireAdmin();
    const action = await readJson<AdminAction>(req);
    if (!ADMIN_ACTION_TYPES.has(action.type)) throw new HttpError(400, "Acción desconocida");

    const db = serviceClient();
    const session = await currentSession();
    let entityId = session.id;
    let detail: string | undefined;

    const rpc = async (fn: string, args: Record<string, unknown>) => {
      const { error } = await db.rpc(fn, args);
      if (error) throw error;
    };

    switch (action.type) {
      case "session/setStatus":
        assert(action.status === "OPEN" || action.status === "CLOSED", "Estado inválido");
        await rpc("set_session_status", { p_session: session.id, p_status: action.status });
        detail = action.status;
        break;
      case "session/updateSettings": {
        const patch = Object.fromEntries(
          Object.entries(action.patch ?? {}).filter(
            ([k, v]) => SETTING_KEYS.has(k) && (typeof v === "number" || typeof v === "boolean"),
          ),
        );
        assert(Object.keys(patch).length > 0, "Nada que actualizar");
        await rpc("update_session_settings", { p_session: session.id, p_patch: patch });
        detail = Object.keys(patch).join(", ");
        break;
      }
      case "session/new": {
        const name = String(action.name ?? "").trim().slice(0, 60) || "Karaoke Night";
        assert(admin.role === "OWNER", "Solo el dueño puede abrir una noche nueva");
        await rpc("new_session", { p_name: name });
        detail = name;
        break;
      }
      case "request/approve":
      case "request/cancel":
      case "queue/call":
      case "performance/start":
      case "performance/skip": {
        assert(isUuid(action.requestId), "Solicitud inválida");
        const fn = {
          "request/approve": "approve_request",
          "request/cancel": "cancel_request",
          "queue/call": "call_request",
          "performance/start": "start_performance",
          "performance/skip": "skip_request",
        }[action.type];
        await rpc(fn, { p_request: action.requestId });
        entityId = action.requestId;
        break;
      }
      case "request/reject":
        assert(isUuid(action.requestId), "Solicitud inválida");
        await rpc("reject_request", { p_request: action.requestId, p_reason: String(action.reason ?? "").slice(0, 120) });
        entityId = action.requestId;
        detail = action.reason || undefined;
        break;
      case "request/replaceSong":
        assert(isUuid(action.requestId) && isUuid(action.songId), "Datos inválidos");
        await rpc("replace_request_song", { p_request: action.requestId, p_song: action.songId });
        entityId = action.requestId;
        break;
      case "queue/reorder":
        assert(Array.isArray(action.orderedIds) && action.orderedIds.every(isUuid), "Cola inválida");
        await rpc("reorder_queue", {
          p_session: session.id,
          p_ids: action.orderedIds,
          p_expected_version: Number.isInteger(action.expectedVersion) ? action.expectedVersion : null,
        });
        break;
      case "song/addByUrl": {
        const videoId = parseVideoId(String(action.url ?? ""));
        assert(videoId, "Enlace de YouTube inválido");
        const [details] = await videosList([videoId]);
        if (!details.available) throw new HttpError(409, "El video no está disponible");
        if (!details.embeddable) throw new HttpError(409, "El video no permite reproducción embebida");
        await upsertSongs([details], "host");
        await db.from("songs").update({ verified: true }).eq("youtube_video_id", videoId);
        entityId = videoId;
        detail = details.title;
        break;
      }
      case "song/flag": {
        assert(isUuid(action.songId), "Canción inválida");
        const patch: Record<string, boolean> = {};
        if (typeof action.verified === "boolean") patch.verified = action.verified;
        if (typeof action.favorite === "boolean") patch.favorite = action.favorite;
        assert(Object.keys(patch).length > 0, "Nada que cambiar");
        const { error } = await db.from("songs").update(patch).eq("id", action.songId);
        if (error) throw error;
        entityId = action.songId;
        detail = Object.entries(patch)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ");
        break;
      }
      case "catalog/addChannel": {
        const ref = String(action.ref ?? "").trim();
        assert(ref.length >= 2, "Canal inválido");
        const handle = ref.startsWith("http") ? (new URL(ref).pathname.split("/").filter(Boolean).pop() ?? ref) : ref;
        const info = await addChannel(handle);
        entityId = info.id;
        detail = info.title;
        break;
      }
      case "catalog/sync": {
        const report = await runCatalogSync(45_000);
        const added = report.channels.reduce((n, c) => n + c.added, 0) + report.queries.reduce((n, q) => n + q.added, 0);
        detail = `+${added} canciones, ${report.quotaUsed} unidades${report.stoppedReason ? ` (detenido: ${report.stoppedReason})` : ""}`;
        break;
      }
      case "performance/pause":
      case "performance/resume":
      case "performance/finish": {
        assert(isUuid(action.performanceId), "Presentación inválida");
        const fn = {
          "performance/pause": "pause_performance",
          "performance/resume": "resume_performance",
          "performance/finish": "finish_performance",
        }[action.type];
        await rpc(fn, { p_performance: action.performanceId });
        entityId = action.performanceId;
        break;
      }
    }

    await db.from("audit_log").insert({
      admin_id: admin.userId,
      action: action.type,
      entity_type: action.type.split("/")[0],
      entity_id: entityId,
      payload: detail ? { detail } : null,
    });
    await broadcast(session.id, "changed");
    return json(await buildSnapshot(deviceFromCookie(req), true));
  });
}
