"use client";

import { useEffect, useImperativeHandle, useRef, forwardRef, type Ref } from "react";
import { cn } from "@/lib/utils";

/* Minimal typing of the YouTube IFrame Player API we use. */
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  mute(): void;
  destroy(): void;
  unloadModule?(name: string): void;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady?: (e: { target: YTPlayer }) => void;
        onStateChange?: (e: { data: number }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.appendChild(s);
  });
  return apiPromise;
}

export interface PlayerHandle {
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  currentTime(): number;
  duration(): number;
}

interface Props {
  videoId: string;
  muted?: boolean;
  autoplay?: boolean;
  startAt?: number;
  className?: string;
  onReady?: () => void;
  onEnded?: () => void;
  onError?: () => void;
  /** Called every second with the current player time while playing. */
  onTime?: (seconds: number) => void;
}

export const YouTubePlayer = forwardRef(function YouTubePlayer(
  { videoId, muted = false, autoplay = true, startAt = 0, className, onReady, onEnded, onError, onTime }: Props,
  ref: Ref<PlayerHandle>,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const callbacks = useRef({ onReady, onEnded, onError, onTime });
  callbacks.current = { onReady, onEnded, onError, onTime };

  useImperativeHandle(ref, () => ({
    play: () => playerRef.current?.playVideo(),
    pause: () => playerRef.current?.pauseVideo(),
    seek: (s) => playerRef.current?.seekTo(s, true),
    currentTime: () => playerRef.current?.getCurrentTime() ?? 0,
    duration: () => playerRef.current?.getDuration() ?? 0,
  }));

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const host = hostRef.current;
    if (!host) return;
    const mount = document.createElement("div");
    host.appendChild(mount);

    loadApi().then((YT) => {
      if (cancelled) return;
      playerRef.current = new YT.Player(mount, {
        videoId,
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          mute: muted ? 1 : 0,
          controls: 0,
          disablekb: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          iv_load_policy: 3,
          cc_load_policy: 0,
          start: Math.floor(startAt),
          origin: window.location.origin,
        },
        events: {
          onReady: (e) => {
            if (muted) e.target.mute();
            // Karaoke videos carry their own lyrics; the caption track only gets in the way.
            e.target.unloadModule?.("captions");
            e.target.unloadModule?.("cc");
            callbacks.current.onReady?.();
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) {
              playerRef.current?.unloadModule?.("captions");
              playerRef.current?.unloadModule?.("cc");
            }
            if (e.data === YT.PlayerState.ENDED) callbacks.current.onEnded?.();
            if (e.data === YT.PlayerState.PLAYING && timer === undefined) {
              timer = window.setInterval(() => {
                callbacks.current.onTime?.(playerRef.current?.getCurrentTime() ?? 0);
              }, 1000);
            }
          },
          onError: () => callbacks.current.onError?.(),
        },
      });
    });

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
      playerRef.current?.destroy();
      playerRef.current = null;
      mount.remove();
    };
    // The player is recreated only when the video changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  return (
    <div className={cn("relative aspect-video w-full overflow-hidden bg-black [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:size-full", className)}>
      <div ref={hostRef} className="absolute inset-0" />
    </div>
  );
});
