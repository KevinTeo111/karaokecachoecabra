import type { SessionSettings, SessionStatus, Vote } from "@/lib/domain/types";

/**
 * Every mutation in the system. The browser dispatches these; the server
 * validates and executes them through Postgres functions. Guest actions are
 * tied to the device cookie, admin actions to the signed-in animador.
 */
export type GuestAction =
  | {
      type: "request/create";
      songId: string;
      displayName: string;
      tableNumber: number;
      /** JPEG data URL rendered on the phone with the brand frame. */
      selfieDataUrl: string;
    }
  | { type: "request/cancel"; requestId: string }
  | { type: "vote/cast"; performanceId: string; stars: Vote["stars"] }
  | { type: "performance/tick"; performanceId: string; playerTime: number };

export type AdminAction =
  | { type: "session/setStatus"; status: SessionStatus }
  | { type: "session/updateSettings"; patch: Partial<SessionSettings> }
  | { type: "session/new"; name: string }
  | { type: "request/approve"; requestId: string }
  | { type: "request/reject"; requestId: string; reason: string }
  | { type: "request/cancel"; requestId: string }
  | { type: "request/replaceSong"; requestId: string; songId: string }
  | { type: "queue/reorder"; orderedIds: string[]; expectedVersion: number }
  | { type: "queue/call"; requestId: string }
  | { type: "performance/start"; requestId: string }
  | { type: "performance/pause"; performanceId: string }
  | { type: "performance/resume"; performanceId: string }
  | { type: "performance/finish"; performanceId: string }
  | { type: "performance/skip"; requestId: string }
  | { type: "song/addByUrl"; url: string }
  | { type: "song/flag"; songId: string; verified?: boolean; favorite?: boolean }
  | { type: "catalog/addChannel"; ref: string }
  | { type: "catalog/sync" };

export type Action = GuestAction | AdminAction;

export const ADMIN_ACTION_TYPES = new Set<Action["type"]>([
  "session/setStatus",
  "session/updateSettings",
  "session/new",
  "request/approve",
  "request/reject",
  "request/replaceSong",
  "queue/reorder",
  "queue/call",
  "performance/start",
  "performance/pause",
  "performance/resume",
  "performance/finish",
  "performance/skip",
  "song/addByUrl",
  "song/flag",
  "catalog/addChannel",
  "catalog/sync",
]);
