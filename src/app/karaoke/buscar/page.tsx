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

const MIN_CHARS = 3;
const DEBOUNCE_MS = 600;

export default function BuscarPage() {
  const router = useRouter();
  const { update } = useDraft();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Song[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Song | null>(null);

  useEffect(() => {
    if (query.trim().length < MIN_CHARS) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        setResults(res.ok ? ((await res.json()) as Song[]) : []);
        setLoading(false);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [query]);

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

      <div className="mt-5 flex-1">
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
          <p className="pt-10 text-center text-sm text-ink-400">
            Escribe al menos {MIN_CHARS} letras. Buscamos versiones karaoke con letra.
          </p>
        ) : results.length === 0 ? (
          <div className="surface mt-6 rounded-2xl p-6 text-center">
            <SearchX className="mx-auto size-6 text-brand-400" />
            <p className="mt-3 font-bold">No encontramos esa canción</p>
            <p className="mt-1 text-sm text-ink-400">
              Prueba con el nombre del artista o pídesela al animador.
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
