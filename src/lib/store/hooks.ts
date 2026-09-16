"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { estimateWaitSec } from "@/lib/domain/eta";
import { rankPerformances } from "@/lib/domain/rating";
import type { KaraokeRequest, QueueEntry, SessionState } from "@/lib/domain/types";
import { ACTIVE_STATUSES, QUEUE_STATUSES } from "@/lib/domain/types";
import type { Action } from "./actions";
import { remoteStore } from "./remote-store";

export function useStore() {
  return useSyncExternalStore(remoteStore.subscribe, remoteStore.getSnapshot, remoteStore.getServerSnapshot);
}

/** Session state. Only render inside <SessionGate>, which guarantees it is loaded. */
export function useSessionState(): SessionState {
  const { state } = useStore();
  if (!state) throw new Error("useSessionState fuera de SessionGate");
  return state;
}

export function useDeviceId(): string | null {
  return useStore().deviceId;
}

export function useDispatch() {
  return useCallback((action: Action) => remoteStore.dispatch(action), []);
}

/** False on the server and during hydration, true on every client render after. */
const noopSubscribe = () => () => {};
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** Server-aligned clock, refreshed every `intervalMs`. Use for ETA and player sync. */
export function useServerNow(intervalMs: number) {
  const { offsetMs } = useStore();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now + offsetMs;
}

export function joinEntry(state: SessionState, request: KaraokeRequest): QueueEntry | null {
  const participant = state.participants.find((p) => p.id === request.participantId);
  const song = state.songs.find((s) => s.id === request.songId);
  if (!participant || !song) return null;
  const performance = state.performances.find((p) => p.requestId === request.id) ?? null;
  return { request, participant, song, performance };
}

const join = (state: SessionState, list: KaraokeRequest[]) =>
  list.map((r) => joinEntry(state, r)).filter((e): e is QueueEntry => e !== null);

export function selectQueue(state: SessionState): QueueEntry[] {
  return join(
    state,
    state.requests
      .filter((r) => QUEUE_STATUSES.includes(r.status))
      .sort((a, b) => (a.queueOrder ?? 0) - (b.queueOrder ?? 0)),
  );
}

export function selectPlaying(state: SessionState): QueueEntry | null {
  const r = state.requests.find((x) => x.status === "PLAYING");
  return r ? joinEntry(state, r) : null;
}

export function selectPending(state: SessionState): QueueEntry[] {
  return join(
    state,
    state.requests.filter((r) => r.status === "PENDING").sort((a, b) => a.requestedAt - b.requestedAt),
  );
}

export function selectHistory(state: SessionState): QueueEntry[] {
  return join(
    state,
    state.requests
      .filter((r) => ["COMPLETED", "SKIPPED", "REJECTED", "CANCELLED"].includes(r.status))
      .sort((a, b) => b.requestedAt - a.requestedAt),
  );
}

export function selectRanking(state: SessionState) {
  return rankPerformances(state.performances, state.settings.minVotesForRanking)
    .map((p) => {
      const r = state.requests.find((x) => x.id === p.requestId);
      return r ? joinEntry(state, r) : null;
    })
    .filter((e): e is QueueEntry => e !== null);
}

/** This device's most relevant request: an active one first, else the latest finished one. */
export function selectMine(state: SessionState): QueueEntry | null {
  const mine = state.requests.filter((r) => state.participants.find((p) => p.id === r.participantId)?.mine);
  const active = mine.find((r) => ACTIVE_STATUSES.includes(r.status));
  const latest = [...mine].sort((a, b) => b.requestedAt - a.requestedAt)[0];
  const chosen = active ?? latest;
  return chosen ? joinEntry(state, chosen) : null;
}

export function useMyEntry() {
  const state = useSessionState();
  return useMemo(() => selectMine(state), [state]);
}

export function useQueuePosition(requestId: string | undefined) {
  const state = useSessionState();
  const now = useServerNow(5000);
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
