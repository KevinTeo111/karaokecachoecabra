"use client";

import { useCallback, useSyncExternalStore } from "react";

/** In-progress request on this phone, before it is submitted. */
export interface Draft {
  songId: string | null;
  displayName: string;
  tableNumber: string;
  selfieUrl: string | null;
  consent: boolean;
}

const KEY = "cec:draft:v1";
const EMPTY: Draft = { songId: null, displayName: "", tableNumber: "", selfieUrl: null, consent: false };

let cache: Draft = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw) cache = { ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) };
  } catch {
    /* ignore */
  }
}

function set(patch: Partial<Draft>) {
  cache = { ...cache, ...patch };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  load();
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useDraft() {
  const draft = useSyncExternalStore(
    subscribe,
    () => {
      load();
      return cache;
    },
    () => EMPTY,
  );
  const update = useCallback((patch: Partial<Draft>) => set(patch), []);
  const clear = useCallback(() => set(EMPTY), []);
  return { draft, update, clear };
}
