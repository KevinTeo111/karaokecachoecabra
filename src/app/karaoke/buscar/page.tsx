"use client";

import { Search, SearchX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ScreenHeader } from "@/components/brand/wordmark";
import { SongCard } from "@/components/client/song-card";
import { YouTubePlayer } from "@/components/player/youtube-player";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Song } from "@/lib/domain/types";
import { useDraft } from "@/lib/store/draft";
import { CATEGORIES, type CategorySlug } from "@/lib/youtube/categories";
import { cn } from "@/lib/utils";

const MIN_CHARS = 3;
const DEBOUNCE_MS = 600;

export default function BuscarPage() {
  const router = useRouter();
  const { update } = useDraft();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategorySlug | null>(null);
  const [results, setResults] = useState<Song[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Song | null>(null);

  const searching = query.trim().length >= MIN_CHARS;

  useEffect(() => {
    const url = searching
      ? `/api/search?q=${encodeURIComponent(query.trim())}`
      : category
        ? `/api/browse?category=${category}`
        : null;
    if (!url) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        setResults(res.ok ? ((await res.json()) as Song[]) : []);
        setLoading(false);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setLoading(false);
        }
      }
    }, searching ? DEBOUNCE_MS : 0);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [query, category, searching]);

  const choose = (song: Song) => {
    update({ song });
    router.push("/karaoke/datos");
  };

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Busca tu canción" />

      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Canción o artista"
          className="pl-11"
          inputMode="search"
          enterKeyHint="search"
        />
      </div>

      <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-none" role="tablist" aria-label="Categorías">
        {CATEGORIES.map((c) => {
          const active = category === c.slug && !searching;
          return (
            <button
              key={c.slug}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setCategory(active ? null : c.slug)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition",
                active
                  ? "border-brand-500 bg-brand-500 text-white shadow-glow"
                  : "border-white/10 bg-white/5 text-ink-300 hover:border-brand-500/40 hover:text-ink-100",
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex-1">
        {loading ? (
          <ul className="space-y-3" aria-busy>
            {[0, 1, 2].map((i) => (
              <li key={i} className="surface flex gap-3 rounded-2xl p-3">
                <div className="skeleton aspect-video w-28 rounded-xl" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="skeleton h-4 w-3/4 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                </div>
              </li>
            ))}
          </ul>
        ) : results === null ? (
          <p className="pt-8 text-center text-sm text-ink-400">
            Escribe al menos {MIN_CHARS} letras o elige una categoría. Buscamos versiones karaoke con letra.
          </p>
        ) : results.length === 0 ? (
          <div className="surface mt-6 rounded-2xl p-6 text-center">
            <SearchX className="mx-auto size-6 text-brand-400" />
            <p className="mt-3 font-bold">{searching ? "No encontramos esa canción" : "Todavía no hay canciones aquí"}</p>
            <p className="mt-1 text-sm text-ink-400">
              {searching ? "Prueba con el nombre del artista o pídesela al animador." : "El animador está completando el catálogo."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {results.map((song, i) => (
              <SongCard key={song.id} song={song} index={i} onChoose={choose} onPreview={setPreview} />
            ))}
          </ul>
        )}
      </div>

      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        {preview ? (
          <DialogContent title={preview.title} description={`${preview.artistGuess} · ${preview.channelTitle}`}>
            <YouTubePlayer videoId={preview.youtubeVideoId} muted className="rounded-xl" />
            <p className="mt-3 text-xs text-ink-400">Preview sin audio. El escenario reproduce con sonido.</p>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
