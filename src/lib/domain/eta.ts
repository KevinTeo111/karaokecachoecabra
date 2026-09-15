import type { QueueEntry } from "./types";

interface EtaInput {
  /** Entries ahead of the target, in queue order. */
  ahead: QueueEntry[];
  /** The entry currently PLAYING, if any. */
  playing: QueueEntry | null;
  bufferSec: number;
  now: number;
}

/**
 * ETA = remaining time of the current song + full duration of every song
 * ahead + a buffer per hand-over (spec §5).
 */
export function estimateWaitSec({ ahead, playing, bufferSec, now }: EtaInput) {
  let total = 0;
  if (playing?.performance) {
    const p = playing.performance;
    const elapsedSinceTick = p.paused ? 0 : (now - p.tickAt) / 1000;
    const position = p.playerTime + elapsedSinceTick;
    total += Math.max(0, playing.song.durationSec - position) + bufferSec;
  }
  for (const entry of ahead) total += entry.song.durationSec + bufferSec;
  return Math.round(total);
}
