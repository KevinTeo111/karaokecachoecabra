import { assertTransition } from "@/lib/domain/state-machine";
import { averageStars, rankPerformances } from "@/lib/domain/rating";
import type {
  KaraokeRequest,
  Participant,
  Performance,
  SessionSettings,
  SessionState,
  SessionStatus,
  Vote,
} from "@/lib/domain/types";
import { ACTIVE_STATUSES, QUEUE_STATUSES } from "@/lib/domain/types";
import { DEMO_SONGS } from "@/lib/mock/catalog";
import { uid } from "@/lib/utils";

export type Action =
  | { type: "session/setStatus"; status: SessionStatus }
  | { type: "session/updateSettings"; patch: Partial<SessionSettings> }
  | { type: "session/reset" }
  | {
      type: "request/create";
      participant: Omit<Participant, "id">;
      songId: string;
    }
  | { type: "request/approve"; requestId: string }
  | { type: "request/reject"; requestId: string; reason: string }
  | { type: "request/cancel"; requestId: string }
  | { type: "request/replaceSong"; requestId: string; songId: string }
  | { type: "queue/reorder"; orderedIds: string[] }
  | { type: "queue/call"; requestId: string }
  | { type: "performance/start"; requestId: string }
  | { type: "performance/pause"; performanceId: string }
  | { type: "performance/resume"; performanceId: string }
  | { type: "performance/tick"; performanceId: string; playerTime: number }
  | { type: "performance/finish"; performanceId: string }
  | { type: "performance/skip"; requestId: string }
  | { type: "vote/cast"; performanceId: string; deviceSessionId: string; stars: Vote["stars"] };

export const DEFAULT_SETTINGS: SessionSettings = {
  etaBufferSec: 45,
  minVotesForRanking: 3,
  blockSameTableVote: false,
  maxActiveRequestsPerDevice: 1,
  prepareNoticeSongs: 2,
};

export function initialState(): SessionState {
  return {
    version: 1,
    session: {
      id: "demo-night",
      name: "Karaoke Night",
      status: "OPEN",
      startsAt: "20:00",
      endsAt: "02:00",
    },
    settings: DEFAULT_SETTINGS,
    songs: DEMO_SONGS,
    participants: [],
    requests: [],
    performances: [],
    votes: [],
    audit: [],
  };
}

function audit(state: SessionState, action: string, entityId: string, detail?: string): SessionState {
  const entry = { id: uid("audit"), at: Date.now(), action, entityId, detail };
  return { ...state, audit: [entry, ...state.audit].slice(0, 200) };
}

function updateRequest(
  state: SessionState,
  requestId: string,
  patch: (r: KaraokeRequest) => KaraokeRequest,
): SessionState {
  return {
    ...state,
    requests: state.requests.map((r) => (r.id === requestId ? patch(r) : r)),
  };
}

function updatePerformance(
  state: SessionState,
  performanceId: string,
  patch: (p: Performance) => Performance,
): SessionState {
  return {
    ...state,
    performances: state.performances.map((p) => (p.id === performanceId ? patch(p) : p)),
  };
}

function nextQueueOrder(state: SessionState) {
  const orders = state.requests
    .filter((r) => r.queueOrder !== null)
    .map((r) => r.queueOrder as number);
  return orders.length ? Math.max(...orders) + 1 : 1;
}

function requireRequest(state: SessionState, id: string) {
  const r = state.requests.find((x) => x.id === id);
  if (!r) throw new Error("Solicitud no encontrada");
  return r;
}

function requirePerformance(state: SessionState, id: string) {
  const p = state.performances.find((x) => x.id === id);
  if (!p) throw new Error("Presentación no encontrada");
  return p;
}

export function reduce(state: SessionState, action: Action): SessionState {
  const now = Date.now();
  switch (action.type) {
    case "session/setStatus":
      return audit({ ...state, session: { ...state.session, status: action.status } }, "session.status", state.session.id, action.status);

    case "session/updateSettings":
      return audit({ ...state, settings: { ...state.settings, ...action.patch } }, "session.settings", state.session.id);

    case "session/reset":
      return initialState();

    case "request/create": {
      if (state.session.status !== "OPEN") throw new Error("El karaoke está cerrado");
      const active = state.requests.filter(
        (r) =>
          ACTIVE_STATUSES.includes(r.status) &&
          state.participants.find((p) => p.id === r.participantId)?.deviceSessionId ===
            action.participant.deviceSessionId,
      );
      if (active.length >= state.settings.maxActiveRequestsPerDevice) {
        throw new Error("Ya tienes una canción activa");
      }
      const song = state.songs.find((s) => s.id === action.songId);
      if (!song || !song.embeddable) throw new Error("Video no disponible");
      const participant: Participant = { id: uid("p"), ...action.participant };
      const request: KaraokeRequest = {
        id: uid("req"),
        participantId: participant.id,
        songId: action.songId,
        status: "PENDING",
        queueOrder: null,
        requestedAt: now,
        approvedAt: null,
        rejectReason: null,
      };
      return audit(
        {
          ...state,
          participants: [...state.participants, participant],
          requests: [...state.requests, request],
        },
        "request.create",
        request.id,
      );
    }

    case "request/approve": {
      const r = requireRequest(state, action.requestId);
      assertTransition(r.status, "APPROVED");
      const order = nextQueueOrder(state);
      return audit(
        updateRequest(state, r.id, (x) => ({ ...x, status: "QUEUED", queueOrder: order, approvedAt: now })),
        "request.approve",
        r.id,
      );
    }

    case "request/reject": {
      const r = requireRequest(state, action.requestId);
      assertTransition(r.status, "REJECTED");
      return audit(
        updateRequest(state, r.id, (x) => ({ ...x, status: "REJECTED", rejectReason: action.reason })),
        "request.reject",
        r.id,
        action.reason,
      );
    }

    case "request/cancel": {
      const r = requireRequest(state, action.requestId);
      assertTransition(r.status, "CANCELLED");
      return audit(
        updateRequest(state, r.id, (x) => ({ ...x, status: "CANCELLED", queueOrder: null })),
        "request.cancel",
        r.id,
      );
    }

    case "request/replaceSong": {
      const r = requireRequest(state, action.requestId);
      if (r.status === "PLAYING" || r.status === "COMPLETED") throw new Error("No se puede reemplazar ahora");
      return audit(updateRequest(state, r.id, (x) => ({ ...x, songId: action.songId })), "request.replace", r.id);
    }

    case "queue/reorder": {
      const orderMap = new Map(action.orderedIds.map((id, i) => [id, i + 1]));
      return audit(
        {
          ...state,
          requests: state.requests.map((r) =>
            orderMap.has(r.id) && QUEUE_STATUSES.includes(r.status)
              ? { ...r, queueOrder: orderMap.get(r.id)! }
              : r,
          ),
        },
        "queue.reorder",
        state.session.id,
      );
    }

    case "queue/call": {
      const r = requireRequest(state, action.requestId);
      assertTransition(r.status, "CALLED");
      return audit(updateRequest(state, r.id, (x) => ({ ...x, status: "CALLED" })), "queue.call", r.id);
    }

    case "performance/start": {
      if (state.requests.some((x) => x.status === "PLAYING")) throw new Error("Ya hay alguien cantando");
      const r = requireRequest(state, action.requestId);
      assertTransition(r.status, "PLAYING");
      const performance: Performance = {
        id: uid("perf"),
        requestId: r.id,
        startedAt: now,
        endedAt: null,
        paused: false,
        playerTime: 0,
        tickAt: now,
        finalRating: null,
        voteCount: 0,
        rank: null,
      };
      return audit(
        {
          ...updateRequest(state, r.id, (x) => ({ ...x, status: "PLAYING" })),
          performances: [...state.performances, performance],
        },
        "performance.start",
        performance.id,
      );
    }

    case "performance/pause":
      return audit(
        updatePerformance(state, action.performanceId, (p) => ({ ...p, paused: true, tickAt: now })),
        "performance.pause",
        action.performanceId,
      );

    case "performance/resume":
      return audit(
        updatePerformance(state, action.performanceId, (p) => ({ ...p, paused: false, tickAt: now })),
        "performance.resume",
        action.performanceId,
      );

    case "performance/tick":
      return updatePerformance(state, action.performanceId, (p) => ({
        ...p,
        playerTime: action.playerTime,
        tickAt: now,
      }));

    case "performance/finish": {
      const p = requirePerformance(state, action.performanceId);
      const r = requireRequest(state, p.requestId);
      assertTransition(r.status, "COMPLETED");
      const votes = state.votes.filter((v) => v.performanceId === p.id);
      const finished: Performance = {
        ...p,
        endedAt: now,
        paused: false,
        finalRating: averageStars(votes),
        voteCount: votes.length,
      };
      const performances = state.performances.map((x) => (x.id === p.id ? finished : x));
      const ranked = rankPerformances(performances, state.settings.minVotesForRanking);
      const withRank = performances.map((x) => {
        const idx = ranked.findIndex((y) => y.id === x.id);
        return { ...x, rank: idx === -1 ? null : idx + 1 };
      });
      return audit(
        {
          ...updateRequest(state, r.id, (x) => ({ ...x, status: "COMPLETED" })),
          performances: withRank,
        },
        "performance.finish",
        p.id,
      );
    }

    case "performance/skip": {
      const r = requireRequest(state, action.requestId);
      assertTransition(r.status, "SKIPPED");
      const perf = state.performances.find((p) => p.requestId === r.id && p.endedAt === null);
      const next = updateRequest(state, r.id, (x) => ({ ...x, status: "SKIPPED", queueOrder: null }));
      return audit(
        perf ? updatePerformance(next, perf.id, (p) => ({ ...p, endedAt: now })) : next,
        "performance.skip",
        r.id,
      );
    }

    case "vote/cast": {
      const p = requirePerformance(state, action.performanceId);
      if (p.endedAt !== null) throw new Error("La votación ya cerró");
      const r = requireRequest(state, p.requestId);
      const singer = state.participants.find((x) => x.id === r.participantId)!;
      if (singer.deviceSessionId === action.deviceSessionId) throw new Error("No puedes votarte a ti mismo");
      if (state.settings.blockSameTableVote) {
        const voterTable = state.participants.find((x) => x.deviceSessionId === action.deviceSessionId)?.tableNumber;
        if (voterTable === singer.tableNumber) throw new Error("Tu mesa no puede votar por su propio cantante");
      }
      if (state.votes.some((v) => v.performanceId === p.id && v.voterDeviceSessionId === action.deviceSessionId)) {
        throw new Error("Ya votaste esta presentación");
      }
      const vote: Vote = {
        id: uid("vote"),
        performanceId: p.id,
        voterDeviceSessionId: action.deviceSessionId,
        stars: action.stars,
        createdAt: now,
      };
      return { ...state, votes: [...state.votes, vote] };
    }
  }
}
