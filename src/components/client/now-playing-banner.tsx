"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LiveDot } from "@/components/ui/badge";
import { selectPlaying, useSessionState } from "@/lib/store/hooks";

/** Persistent invitation to vote whenever someone else is on stage. */
export function NowPlayingBanner() {
  const state = useSessionState();
  const pathname = usePathname();
  const playing = selectPlaying(state);
  if (!playing || playing.participant.mine) return null;
  if (pathname.startsWith("/karaoke/votar")) return null;
  const voted = state.votes.some((v) => v.performanceId === playing.performance?.id && v.mine);

  return (
    <Link
      href="/karaoke/votar"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-center gap-3 border-t border-brand-500/30 bg-ink-900/95 px-4 py-3 backdrop-blur safe-bottom animate-rise"
    >
      <LiveDot />
      <div className="min-w-0 flex-1">
        <p className="eyebrow">Ahora canta</p>
        <p className="truncate text-sm font-bold text-ink-100">
          {playing.participant.displayName} · Mesa {playing.participant.tableNumber} · {playing.song.title}
        </p>
      </div>
      <span className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-ink-950">
        <Star className="size-3 fill-current" /> {voted ? "Votado" : "Votar"}
      </span>
    </Link>
  );
}
