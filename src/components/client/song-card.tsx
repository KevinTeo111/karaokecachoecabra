"use client";

import { BadgeCheck, Heart, Play } from "lucide-react";
import Image from "next/image";
import type { Song } from "@/lib/domain/types";
import { cn, formatDuration, thumbnailUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function SongThumb({ song, className }: { song: Song; className?: string }) {
  return (
    <div className={cn("relative aspect-video shrink-0 overflow-hidden rounded-xl bg-ink-700", className)}>
      <Image
        src={thumbnailUrl(song.youtubeVideoId)}
        alt=""
        fill
        sizes="160px"
        className="object-cover"
        unoptimized
      />
      <span className="absolute bottom-1 right-1 rounded-md bg-ink-950/80 px-1.5 py-0.5 text-[0.65rem] font-bold tabular-nums text-ink-100">
        {formatDuration(song.durationSec)}
      </span>
    </div>
  );
}

export function SongCard({
  song,
  onChoose,
  onPreview,
  index = 0,
}: {
  song: Song;
  onChoose: (song: Song) => void;
  onPreview: (song: Song) => void;
  index?: number;
}) {
  return (
    <li
      className="surface flex gap-3 rounded-2xl p-3 animate-rise"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <button
        type="button"
        onClick={() => onPreview(song)}
        className="group relative w-28 shrink-0 focus-visible:outline-none"
        aria-label={`Ver preview de ${song.title}`}
      >
        <SongThumb song={song} />
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-9 place-items-center rounded-full bg-ink-950/70 text-ink-100 ring-1 ring-white/20 transition group-hover:bg-brand-500 group-hover:text-white">
            <Play className="size-4 fill-current" />
          </span>
        </span>
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate font-bold text-ink-100">{song.title}</p>
        <p className="truncate text-xs text-ink-400">
          {song.artistGuess} · {song.channelTitle}
        </p>
        <div className="mt-1 flex items-center gap-2">
          {song.verified ? (
            <span className="inline-flex items-center gap-1 text-[0.65rem] font-bold uppercase tracking-wider text-success">
              <BadgeCheck className="size-3" /> Verificada
            </span>
          ) : null}
          {song.favorite ? (
            <span className="inline-flex items-center gap-1 text-[0.65rem] font-bold uppercase tracking-wider text-brand-400">
              <Heart className="size-3 fill-current" /> Favorita
            </span>
          ) : null}
        </div>
        <div className="mt-auto flex justify-end pt-2">
          <Button size="sm" onClick={() => onChoose(song)}>
            Elegir
          </Button>
        </div>
      </div>
    </li>
  );
}
