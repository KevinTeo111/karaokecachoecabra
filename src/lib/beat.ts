"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Beat clock for the stage screen. YouTube's player exposes no audio, so the
 * only real signal is the room itself: with microphone permission the TV
 * device listens, detects onsets in the low band and estimates BPM. Without a
 * microphone the caller falls back to a tempo guessed from the song's
 * categories.
 */
export interface BeatClock {
  /** Estimated beats per minute, or null when no microphone is available. */
  bpm: number | null;
  /** Whether the microphone is currently feeding the detector. */
  listening: boolean;
}

const CATEGORY_BPM: Record<string, number> = {
  boleros: 70,
  romanticas: 78,
  "80s": 118,
  "90s": 112,
  "2000s": 110,
  latinas: 100,
  rock: 125,
};

export function tempoForCategories(categories: string[]): number {
  const known = categories.map((c) => CATEGORY_BPM[c]).filter((v): v is number => typeof v === "number");
  if (known.length === 0) return 100;
  return Math.round(known.reduce((a, b) => a + b, 0) / known.length);
}

/** Milliseconds between logo changes: one change every `beats` beats. */
export function logoIntervalMs(bpm: number, beats = 8) {
  return Math.round((60_000 / Math.max(50, Math.min(200, bpm))) * beats);
}

export function useBeatClock(enabled: boolean): BeatClock {
  const [clock, setClock] = useState<BeatClock>({ bpm: null, listening: false });
  const intervals = useRef<number[]>([]);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    let cancelled = false;
    let ctx: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let raf = 0;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false }, video: false });
      } catch {
        return;
      }
      if (cancelled) return;
      ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.2;
      source.connect(analyser);
      const bins = new Uint8Array(analyser.frequencyBinCount);
      const lowBins = Math.max(4, Math.floor((250 / (ctx.sampleRate / 2)) * bins.length));
      const history: number[] = [];
      let lastBeat = 0;
      setClock({ bpm: null, listening: true });

      const tick = () => {
        if (cancelled) return;
        analyser.getByteFrequencyData(bins);
        let energy = 0;
        for (let i = 0; i < lowBins; i++) energy += bins[i] * bins[i];
        energy /= lowBins;
        history.push(energy);
        if (history.length > 43) history.shift();
        const avg = history.reduce((a, b) => a + b, 0) / history.length;
        const now = performance.now();
        if (history.length >= 20 && energy > avg * 1.5 && energy > 400 && now - lastBeat > 250) {
          if (lastBeat) {
            const gap = now - lastBeat;
            if (gap < 1500) {
              intervals.current.push(gap);
              if (intervals.current.length > 16) intervals.current.shift();
              if (intervals.current.length >= 6) {
                const sorted = [...intervals.current].sort((a, b) => a - b);
                const median = sorted[Math.floor(sorted.length / 2)];
                setClock({ bpm: Math.round(60_000 / median), listening: true });
              }
            }
          }
          lastBeat = now;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close();
      setClock({ bpm: null, listening: false });
    };
  }, [enabled]);

  return clock;
}
