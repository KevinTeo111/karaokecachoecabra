import type { RealtimeChannel } from "@supabase/supabase-js";
import type { SessionState } from "@/lib/domain/types";
import { browserClient } from "@/lib/supabase/browser";
import type { Action } from "./actions";

export interface ClientSnapshot {
  state: SessionState | null;
  deviceId: string | null;
  /** Realtime channel subscribed. When false the store polls instead. */
  connected: boolean;
  /** Fatal load error message, if the first snapshot could not be fetched. */
  error: string | null;
  /** serverNow - Date.now() at the last snapshot; add to local time to get server time. */
  offsetMs: number;
}

const INITIAL: ClientSnapshot = { state: null, deviceId: null, connected: false, error: null, offsetMs: 0 };
const DEVICE_KEY = "cec:device:v2";
const POLL_MS = 12_000;
const HEARTBEAT_MS = 45_000;
const REFETCH_DEBOUNCE_MS = 150;

type Listener = () => void;

/**
 * Client-side mirror of the session, kept fresh by Supabase Realtime
 * broadcasts from the server plus a polling fallback. Mutations are HTTP
 * calls; the server answers with the fresh snapshot.
 */
class RemoteStore {
  private snap: ClientSnapshot = INITIAL;
  private listeners = new Set<Listener>();
  private started = false;
  private channel: RealtimeChannel | null = null;
  private pollTimer: number | null = null;
  private refetchTimer: number | null = null;
  private inFlight: Promise<void> | null = null;

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    this.start();
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.snap;
  getServerSnapshot = () => INITIAL;

  private set(patch: Partial<ClientSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    for (const l of this.listeners) l();
  }

  serverNow() {
    return Date.now() + this.snap.offsetMs;
  }

  private start() {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    void this.boot();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void this.refetch();
    });
  }

  private async boot() {
    try {
      const table = new URLSearchParams(window.location.search).get("table");
      await this.registerDevice(table ? Number(table) : null);
      await this.refetch();
    } catch (e) {
      this.set({ error: e instanceof Error ? e.message : "No se pudo conectar" });
    }
    this.schedulePoll();
    window.setInterval(() => void this.refetch(), HEARTBEAT_MS);
  }

  async registerDevice(table: number | null) {
    const res = await fetch("/api/device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: Number.isInteger(table) ? table : null }),
    });
    if (!res.ok) throw new Error("No se pudo registrar el dispositivo");
    const { deviceId } = (await res.json()) as { deviceId: string };
    try {
      window.localStorage.setItem(DEVICE_KEY, deviceId);
    } catch {
      /* ignore */
    }
    this.set({ deviceId });
  }

  refetch(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = (async () => {
      try {
        const res = await fetch("/api/session/state", { cache: "no-store" });
        if (res.status === 401) {
          await this.registerDevice(null);
          return this.refetch();
        }
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Error al cargar");
        this.applyState((await res.json()) as SessionState);
      } finally {
        this.inFlight = null;
      }
    })();
    return this.inFlight;
  }

  private applyState(state: SessionState) {
    const offsetMs = state.serverNow - Date.now();
    this.set({ state, offsetMs, error: null });
    this.ensureChannel(state.session.id);
  }

  private requestRefetch() {
    if (this.refetchTimer) window.clearTimeout(this.refetchTimer);
    this.refetchTimer = window.setTimeout(() => void this.refetch(), REFETCH_DEBOUNCE_MS);
  }

  private ensureChannel(sessionId: string) {
    const topic = `session:${sessionId}`;
    if (this.channel?.topic === `realtime:${topic}`) return;
    if (this.channel) void browserClient().removeChannel(this.channel);
    this.channel = browserClient()
      .channel(topic, { config: { broadcast: { self: true } } })
      .on("broadcast", { event: "changed" }, () => this.requestRefetch())
      .on("broadcast", { event: "tick" }, ({ payload }) => this.applyTick(payload as TickPayload))
      .subscribe((status) => {
        const connected = status === "SUBSCRIBED";
        if (connected && !this.snap.connected) void this.refetch();
        this.set({ connected });
        this.schedulePoll();
      });
  }

  private applyTick({ performanceId, playerTime, at }: TickPayload) {
    const state = this.snap.state;
    if (!state) return;
    const performances = state.performances.map((p) =>
      p.id === performanceId ? { ...p, playerTime, tickAt: at } : p,
    );
    this.set({ state: { ...state, performances } });
  }

  /** Poll only while realtime is down; a live channel makes polling redundant. */
  private schedulePoll() {
    if (this.pollTimer) window.clearInterval(this.pollTimer);
    this.pollTimer = this.snap.connected ? null : window.setInterval(() => void this.refetch(), POLL_MS);
  }

  /** Resolves to null on success or a user-facing error message. */
  async dispatch(action: Action): Promise<string | null> {
    const { url, body } = route(action);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as SessionState | { error?: string };
      if (!res.ok) return (data as { error?: string }).error ?? "Error inesperado";
      if ("session" in data) this.applyState(data);
      return null;
    } catch {
      return "Sin conexión. Intenta de nuevo.";
    }
  }
}

interface TickPayload {
  performanceId: string;
  playerTime: number;
  at: number;
}

function route(action: Action): { url: string; body: unknown } {
  switch (action.type) {
    case "request/create":
      return { url: "/api/requests", body: action };
    case "request/cancel":
      return { url: `/api/requests/${action.requestId}/cancel`, body: {} };
    case "vote/cast":
      return { url: "/api/votes", body: { performanceId: action.performanceId, stars: action.stars } };
    case "performance/tick":
      return { url: `/api/performances/${action.performanceId}/tick`, body: { playerTime: action.playerTime } };
    default:
      return { url: "/api/admin/actions", body: action };
  }
}

export const remoteStore = new RemoteStore();
