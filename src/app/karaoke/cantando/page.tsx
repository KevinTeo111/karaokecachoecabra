"use client";

import { Maximize2, Minimize2, Pause, RefreshCcw, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScreenHeader } from "@/components/brand/wordmark";
import { YouTubePlayer, type PlayerHandle } from "@/components/player/youtube-player";
import { Button } from "@/components/ui/button";
import { useDeviceId, useMyEntry, useServerNow, useStore } from "@/lib/store/hooks";
import { cn, formatDuration } from "@/lib/utils";

const DRIFT_TOLERANCE_SEC = 1.5;
const SYNC_INTERVAL_MS = 5000;

/** Expected stage position from the last tick the TV published. */
function expectedTime(playerTime: number, tickAt: number, paused: boolean, now: number) {
  return paused ? playerTime : playerTime + (now - tickAt) / 1000;
}

interface OrientationLock {
  lock?: (o: "landscape") => Promise<void>;
  unlock?: () => void;
}

export default function CantandoPage() {
  const router = useRouter();
  const mine = useMyEntry();
  const playerRef = useRef<PlayerHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [wide, setWide] = useState(false);
  const [localTime, setLocalTime] = useState(0);
  const [drift, setDrift] = useState(0);
  const now = useServerNow(1000);
  const { offsetMs } = useStore();
  const deviceId = useDeviceId();

  const status = mine?.request.status;
  const perf = mine?.performance ?? null;

  useEffect(() => {
    if (deviceId === null) return;
    if (!mine) router.replace("/karaoke/fila");
    else if (status === "COMPLETED") router.replace("/karaoke/resultado");
    else if (status !== "PLAYING") router.replace("/karaoke/fila");
  }, [deviceId, mine, status, router]);

  const sync = useCallback(
    (force = false) => {
      const p = playerRef.current;
      if (!p || !perf) return;
      const expected = expectedTime(perf.playerTime, perf.tickAt, perf.paused, Date.now() + offsetMs);
      const d = p.currentTime() - expected;
      setDrift(d);
      if (force || Math.abs(d) > DRIFT_TOLERANCE_SEC) p.seek(expected);
    },
    [perf, offsetMs],
  );

  useEffect(() => {
    if (!armed) return;
    const id = window.setInterval(() => sync(), SYNC_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [armed, sync]);

  useEffect(() => {
    if (!armed || !perf) return;
    if (perf.paused) playerRef.current?.pause();
    else {
      playerRef.current?.play();
      sync(true);
    }
    // Reacts to pause/resume only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed, perf?.paused]);

  // Full-screen mode: browser fullscreen + landscape lock where the phone allows it,
  // and a fixed overlay layout everywhere else (iPhone has no element fullscreen).
  const enterWide = async () => {
    setWide(true);
    try {
      await document.documentElement.requestFullscreen?.();
      await (screen.orientation as unknown as OrientationLock).lock?.("landscape");
    } catch {
      /* not supported: the overlay layout still works, the guest rotates the phone */
    }
  };
  const exitWide = async () => {
    setWide(false);
    try {
      (screen.orientation as unknown as OrientationLock).unlock?.();
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setWide(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  if (!mine || !perf || status !== "PLAYING") return null;

  const stageTime = expectedTime(perf.playerTime, perf.tickAt, perf.paused, now);
  const pct = Math.min(100, (stageTime / mine.song.durationSec) * 100);

  const controls = (
    <div className={cn("flex items-center gap-3", wide ? "px-4 py-2" : "mt-auto pt-6")}>
      {wide ? (
        <span className="text-xs tabular-nums text-ink-300">
          {formatDuration(armed ? localTime : stageTime)} / {formatDuration(mine.song.durationSec)}
        </span>
      ) : null}
      <Button variant="secondary" size={wide ? "sm" : "lg"} block={!wide} className={wide ? "ml-auto" : ""} onClick={() => sync(true)} disabled={!armed}>
        <RefreshCcw className="size-4" /> Sincronizar
        {armed && Math.abs(drift) > 0.5 ? (
          <span className="text-xs font-normal normal-case tracking-normal text-ink-400">
            ({drift > 0 ? "+" : ""}
            {drift.toFixed(1)} s)
          </span>
        ) : null}
      </Button>
      <Button variant="ghost" size={wide ? "sm" : "icon"} onClick={() => void (wide ? exitWide() : enterWide())} aria-label={wide ? "Salir de pantalla completa" : "Pantalla completa"}>
        {wide ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
      </Button>
    </div>
  );

  return (
    <div className={cn("flex flex-1 flex-col", wide && "fixed inset-0 z-50 bg-black")}>
      {!wide ? <ScreenHeader title="Estás cantando" subtitle="Video karaoke sincronizado · audio silenciado" /> : null}

      <div
        ref={stageRef}
        className={cn("relative overflow-hidden", wide ? "flex min-h-0 flex-1 items-center justify-center bg-black" : "mt-6 rounded-2xl shadow-glow")}
      >
        {armed ? (
          <YouTubePlayer
            ref={playerRef}
            videoId={mine.song.youtubeVideoId}
            muted
            startAt={stageTime}
            onReady={() => sync(true)}
            onTime={setLocalTime}
            className={wide ? "max-h-full w-full" : ""}
          />
        ) : (
          <button type="button" onClick={() => setArmed(true)} className="grid aspect-video w-full place-items-center bg-ink-900 text-center">
            <span>
              <span className="block text-display text-3xl uppercase text-brand-400">Ver mi monitor</span>
              <span className="mt-1 block text-xs text-ink-400">Toca para activar el video sin audio</span>
            </span>
          </button>
        )}
        {perf.paused ? (
          <div className="absolute inset-0 grid place-items-center bg-ink-950/70 backdrop-blur-sm">
            <span className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-sm font-bold">
              <Pause className="size-4 text-brand-400" /> En pausa
            </span>
          </div>
        ) : null}
      </div>

      {wide ? (
        controls
      ) : (
        <>
          <div className="mt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
              <div className="h-full bg-brand-500 transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-xs tabular-nums text-ink-400">
              <span>{formatDuration(armed ? localTime : stageTime)}</span>
              <span>{formatDuration(mine.song.durationSec)}</span>
            </div>
          </div>

          <div className="surface mt-6 rounded-2xl p-5 text-center">
            <p className="text-xs text-ink-400">Tu celular funciona como</p>
            <p className="text-display mt-1 text-3xl uppercase text-brand-400">Monitor personal</p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-400">
              <VolumeX className="size-3" /> sin reproducir audio · gira el celular o usa pantalla completa
            </p>
          </div>
          {controls}
        </>
      )}
    </div>
  );
}
