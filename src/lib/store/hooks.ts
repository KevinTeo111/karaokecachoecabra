"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { estimateWaitSec } from "@/lib/domain/eta";
import { rankPerformances } from "@/lib/domain/rating";
import type { KaraokeRequest, QueueEntry, SessionState } from "@/lib/domain/types";
import { ACTIVE_STATUSES, QUEUE_STATUSES } from "@/lib/domain/types";
import { uid } from "@/lib/utils";
import type { Action } from "./reducer";
import { sessionStore } from "./session-store";

const DEVICE_KEY = "cec:device:v1";

export function useSessionState(): SessionState {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot, sessionStore.getServerSnapshot);
}

export function useDispatch() {
  return useCallback((action: Action) => {
    try {
      sessionStore.dispatch(action);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Error inesperado";
    }
  }, []);
}

let deviceIdCache: string | null = null;
function readDeviceId(): string {
  if (deviceIdCache) return deviceIdCache;
  try {
    let stored = window.localStorage.getItem(DEVICE_KEY);
    if (!stored) {
      stored = uid("dev");
      window.localStorage.setItem(DEVICE_KEY, stored);
    }
    deviceIdCache = stored;
  } catch {
    deviceIdCache = uid("dev");
  }
  return deviceIdCache;
}
const noopSubscribe = () => () => {};

/**
 * Stable anonymous identity for this browser. Available on the very first
 * client render (null only on the server and during hydration), so pages
 * can tell "unknown yet" apart from "known, no request".
 */
export function useDeviceId(): string | null {
  return useSyncExternalStore(noopSubscribe, readDeviceId, () => null);
}

/** False on the server and during hydration, true on every client render after. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function joinEntry(state: SessionState, request: KaraokeRequest): QueueEntry | null {
  const participant = state.participants.find((p) => p.id === request.participantId);
  const song = state.songs.find((s) => s.id === request.songId);
  if (!participant || !song) return null;
  const performance = state.performances.find((p) => p.requestId === request.id) ?? null;
  return { request, participant, song, performance };
}

export function selectQueue(state: SessionState): QueueEntry[] {
  return state.requests
    .filter((r) => QUEUE_STATUSES.includes(r.status))
    .sort((a, b) => (a.queueOrder ?? 0) - (b.queueOrder ?? 0))
    .map((r) => joinEntry(state, r))
    .filter((e): e is QueueEntry => e !== null);
}

export function selectPlaying(state: SessionState): QueueEntry | null {
  const r = state.requests.find((x) => x.status === "PLAYING");
  return r ? joinEntry(state, r) : null;
}

export function selectPending(state: SessionState): QueueEntry[] {
  return state.requests
    .filter((r) => r.status === "PENDING")
    .sort((a, b) => a.requestedAt - b.requestedAt)
    .map((r) => joinEntry(state, r))
    .filter((e): e is QueueEntry => e !== null);
}

export function selectHistory(state: SessionState): QueueEntry[] {
  return state.requests
    .filter((r) => ["COMPLETED", "SKIPPED", "REJECTED", "CANCELLED"].includes(r.status))
    .sort((a, b) => b.requestedAt - a.requestedAt)
    .map((r) => joinEntry(state, r))
    .filter((e): e is QueueEntry => e !== null);
}

export function selectRanking(state: SessionState) {
  return rankPerformances(state.performances, state.settings.minVotesForRanking)
    .map((p) => {
      const r = state.requests.find((x) => x.id === p.requestId);
      return r ? joinEntry(state, r) : null;
    })
    .filter((e): e is QueueEntry => e !== null);
}

/** The most relevant request for this device: active first, else the latest finished one. */
export function selectMine(state: SessionState, deviceId: string | null): QueueEntry | null {
  if (!deviceId) return null;
  const mine = state.requests.filter(
    (r) => state.participants.find((p) => p.id === r.participantId)?.deviceSessionId === deviceId,
  );
  const active = mine.find((r) => ACTIVE_STATUSES.includes(r.status));
  const latest = [...mine].sort((a, b) => b.requestedAt - a.requestedAt)[0];
  const chosen = active ?? latest;
  return chosen ? joinEntry(state, chosen) : null;
}

export function useMyEntry() {
  const state = useSessionState();
  const deviceId = useDeviceId();
  return useMemo(() => selectMine(state, deviceId), [state, deviceId]);
}

export function useQueuePosition(requestId: string | undefined) {
  const state = useSessionState();
  const now = useNow(5000);
  return useMemo(() => {
    if (!requestId) return null;
    const queue = selectQueue(state);
    const idx = queue.findIndex((e) => e.request.id === requestId);
    if (idx === -1) return null;
    const playing = selectPlaying(state);
    const waitSec = estimateWaitSec({
      ahead: queue.slice(0, idx),
      playing,
      bufferSec: state.settings.etaBufferSec,
      now,
    });
    return { position: idx + 1, ahead: idx + (playing ? 1 : 0), waitSec };
  }, [state, requestId, now]);
}

export function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
