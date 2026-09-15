import type { SessionState } from "@/lib/domain/types";
import { type Action, initialState, reduce } from "./reducer";

const STORAGE_KEY = "cec:karaoke:v1";

type Listener = () => void;

/**
 * Local, cross-tab reactive store. Mirrors the shape of the future realtime
 * backend: every mutation is an action, every screen subscribes to state.
 * Persistence is localStorage; other tabs receive the `storage` event and
 * re-render, which is how the panel drives phones and TVs in the demo.
 */
class SessionStore {
  private state: SessionState;
  private readonly serverState: SessionState;
  private listeners = new Set<Listener>();
  private hydrated = false;

  constructor() {
    this.serverState = initialState();
    this.state = this.serverState;
  }

  private hydrate() {
    if (this.hydrated || typeof window === "undefined") return;
    this.hydrated = true;
    this.state = readStorage() ?? this.state;
    window.addEventListener("storage", (e) => {
      if (e.key !== STORAGE_KEY) return;
      const next = readStorage();
      if (next) {
        this.state = next;
        this.emit();
      }
    });
  }

  subscribe = (listener: Listener) => {
    this.hydrate();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => {
    this.hydrate();
    return this.state;
  };

  getServerSnapshot = () => this.serverState;

  dispatch = (action: Action) => {
    this.hydrate();
    this.state = reduce(this.state, action);
    writeStorage(this.state);
    this.emit();
  };

  private emit() {
    for (const l of this.listeners) l();
  }
}

function readStorage(): SessionState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionState;
    return parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

function writeStorage(state: SessionState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota exceeded or private mode: the in-memory state still works */
  }
}

export const sessionStore = new SessionStore();
