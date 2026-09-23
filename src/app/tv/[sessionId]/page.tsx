"use client";

import { Mic2, QrCode, Star, Trophy } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { BrandLogo, LogoCarousel } from "@/components/brand/logo";
import { logoIntervalMs, tempoForCategories, useBeatClock } from "@/lib/beat";
import { Stars } from "@/components/brand/wordmark";
import { YouTubePlayer, type PlayerHandle } from "@/components/player/youtube-player";
import type { QueueEntry, SessionState } from "@/lib/domain/types";
import {
  joinEntry,
  selectPlaying,
  selectQueue,
  selectRanking,
  useDispatch,
  useServerNow,
  useSessionState,
} from "@/lib/store/hooks";
import { formatRating, tableLabel } from "@/lib/utils";

const TICK_EVERY_SEC = 5;
const RESULT_SHOWN_MS = 90_000;
const TV_KEY_STORAGE = "cec:tvkey";

export default function TvPage() {
  return (
    <Suspense>
      <Tv />
    </Suspense>
  );
}

/**
 * Stage screen. The player here is the time reference for every phone: it
 * reports its position every few seconds, obeys pause/resume from the panel,
 * and when the video ends it closes the performance itself so the result and
 * the next singer appear without anyone touching the TV.
 */
function Tv() {
  const state = useSessionState();
  const dispatch = useDispatch();
  const params = useSearchParams();
  const now = useServerNow(1000);
  const playing = selectPlaying(state);
  const queue = selectQueue(state);
  const ranking = selectRanking(state).slice(0, 5);
  const [armed, setArmed] = useState(false);
  const [tvKey, setTvKey] = useState<string | undefined>(undefined);
  const playerRef = useRef<PlayerHandle>(null);
  const lastTick = useRef(0);
  const lastPaused = useRef<boolean | null>(null);
  const endedFor = useRef<string | null>(null);
  const perf = playing?.performance ?? null;

  // Logo rhythm: the room's beat when the TV device has a microphone, else the song's genre tempo.
  const beat = useBeatClock(armed);
  const bpm = beat.bpm ?? tempoForCategories(playing?.song.categories ?? []);
  const logoEvery = logoIntervalMs(bpm, playing ? 8 : 16);

  // The key arrives once in the panel's link and is remembered for reloads.
  useEffect(() => {
    const fromUrl = params.get("k");
    try {
      if (fromUrl) window.sessionStorage.setItem(TV_KEY_STORAGE, fromUrl);
      setTvKey(fromUrl ?? window.sessionStorage.getItem(TV_KEY_STORAGE) ?? undefined);
    } catch {
      setTvKey(fromUrl ?? undefined);
    }
  }, [params]);

  // React to pause/resume transitions only, never to routine state refreshes,
  // otherwise a finished video would be restarted by the next update.
  useEffect(() => {
    if (!perf) {
      lastPaused.current = null;
      return;
    }
    if (lastPaused.current === null) {
      lastPaused.current = perf.paused;
      return;
    }
    if (perf.paused !== lastPaused.current) {
      lastPaused.current = perf.paused;
      if (perf.paused) playerRef.current?.pause();
      else playerRef.current?.play();
    }
  }, [perf]);

  const lastResult = latestResult(state, now);

  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)} className="stage-bg grid h-dvh w-dvw place-items-center text-center">
        <span className="flex flex-col items-center">
          <BrandLogo className="h-[34vmin]" wordmarkSize="lg" />
          <span className="text-display mt-[3vmin] block text-[8vmin] uppercase leading-none">Karaoke Night</span>
          <span className="mt-[4vmin] inline-block rounded-full bg-brand-500 px-[4vmin] py-[1.5vmin] text-[2vmin] font-bold uppercase tracking-[0.2em] text-white shadow-glow">
            Activar pantalla
          </span>
          <span className="mt-[2vmin] block text-[1.6vmin] text-ink-400">Un toque habilita el audio en esta TV</span>
        </span>
      </button>
    );
  }

  return (
    <div className="stage-bg flex h-dvh w-dvw flex-col overflow-hidden p-[2vmin] text-ink-100">
      <header className="flex items-center justify-between px-[1vmin] pb-[1.5vmin]">
        <div className="flex items-center gap-[2vmin]">
          <LogoCarousel intervalMs={logoEvery} className="h-[9vmin] w-[14vmin]" />
          <p className="text-display text-[3.2vmin] uppercase tracking-wider text-brand-400">Karaoke Night</p>
        </div>
        <p className="inline-flex items-center gap-2 text-[1.8vmin] text-ink-300">
          <QrCode className="size-[2.4vmin]" /> Escanea el QR de tu mesa para cantar y votar
        </p>
      </header>

      {playing && perf ? (
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_28vmin] gap-[2vmin]">
          <div className="relative min-h-0 overflow-hidden rounded-[2vmin] bg-black shadow-glow">
            <YouTubePlayer
              key={perf.id}
              ref={playerRef}
              videoId={playing.song.youtubeVideoId}
              startAt={perf.playerTime}
              className="h-full"
              onTime={(t) => {
                if (t - lastTick.current >= TICK_EVERY_SEC || t < lastTick.current) {
                  lastTick.current = t;
                  void dispatch({ type: "performance/tick", performanceId: perf.id, playerTime: t, tvKey });
                }
              }}
              onEnded={() => {
                if (endedFor.current === perf.id) return;
                endedFor.current = perf.id;
                void dispatch({ type: "performance/ended", performanceId: perf.id, tvKey });
              }}
            />
            {perf.paused ? (
              <div className="absolute inset-0 grid place-items-center bg-ink-950/70 backdrop-blur-sm">
                <span className="text-display text-[6vmin] uppercase text-brand-400">Pausa</span>
              </div>
            ) : null}
          </div>
          <aside className="surface-brand flex flex-col items-center rounded-[2vmin] p-[2vmin] text-center">
            <p className="eyebrow text-[1.5vmin]">Ahora canta</p>
            <Selfie entry={playing} className="mt-[1.5vmin] h-[30vmin] w-[20vmin] rounded-[1.5vmin]" />
            <p className="text-display mt-[2vmin] text-[4.5vmin] uppercase leading-none">{playing.participant.displayName}</p>
            <p className="text-[2vmin] font-bold text-brand-400">{tableLabel(playing.participant.tableNumber)}</p>
            <div className="mt-[3vmin] border-t border-brand-500/30 pt-[2vmin]">
              <p className="text-[2.4vmin] font-bold uppercase leading-tight">{playing.song.title}</p>
              <p className="text-[1.8vmin] text-ink-300">{playing.song.artistGuess}</p>
            </div>
            <p className="mt-auto inline-flex items-center gap-1 text-[1.6vmin] font-bold uppercase tracking-widest text-brand-400">
              <Star className="size-[1.8vmin] fill-current" /> vota desde tu celular
            </p>
          </aside>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[1.2fr_1fr] gap-[2vmin]">
          <section className="surface flex min-h-0 flex-col rounded-[2vmin] p-[3vmin]">
            {lastResult ? (
              <div className="surface-brand mb-[2vmin] flex items-center gap-[3vmin] rounded-[1.5vmin] p-[2vmin] animate-rise">
                <Selfie entry={lastResult} className="h-[18vmin] w-[12vmin] rounded-[1.5vmin]" />
                <div className="min-w-0 flex-1">
                  <p className="eyebrow text-[1.5vmin]">Resultado</p>
                  <p className="text-display truncate text-[4vmin] uppercase leading-none">
                    {lastResult.participant.displayName} · {tableLabel(lastResult.participant.tableNumber)}
                  </p>
                  <p className="truncate text-[1.9vmin] text-ink-300">{lastResult.song.title}</p>
                </div>
                <div className="text-center">
                  {lastResult.performance!.finalRating === null ? (
                    <p className="text-display text-[3vmin] uppercase text-ink-300">Sin votos</p>
                  ) : (
                    <>
                      <p className="text-display text-[7vmin] leading-none text-gold">{formatRating(lastResult.performance!.finalRating)}</p>
                      <Stars value={lastResult.performance!.finalRating} className="justify-center" size="size-[2.2vmin]" />
                    </>
                  )}
                  <p className="text-[1.6vmin] text-ink-400">
                    {lastResult.performance!.voteCount} {lastResult.performance!.voteCount === 1 ? "voto" : "votos"}
                    {lastResult.performance!.rank ? ` · #${lastResult.performance!.rank} de la noche` : ""}
                  </p>
                </div>
              </div>
            ) : null}

            <p className="eyebrow text-[1.6vmin]">{queue.length ? "Siguiente" : "Próximos turnos"}</p>
            {queue.length === 0 ? (
              <div className="grid flex-1 place-items-center text-center">
                <div className="flex flex-col items-center">
                  <LogoCarousel intervalMs={logoEvery} className="h-[34vmin] w-[50vmin]" />
                  <p className="text-display mt-[2vmin] text-[6vmin] uppercase">La noche es tuya</p>
                  <p className="text-[2vmin] text-ink-300">Escanea el QR, elige tu canción y entra a la fila.</p>
                </div>
              </div>
            ) : (
              <ol className="mt-[1.5vmin] flex min-h-0 flex-col gap-[1.2vmin] overflow-hidden">
                {queue.slice(0, 4).map((e, i) => (
                  <li
                    key={e.request.id}
                    className={`flex items-center gap-[2vmin] rounded-[1.5vmin] p-[1.5vmin] ${i === 0 ? "surface-brand shadow-glow" : "bg-white/5"}`}
                  >
                    <span className="text-display w-[4vmin] text-[5vmin] text-brand-500">{i + 1}</span>
                    <Selfie entry={e} className={`${i === 0 ? "size-[10vmin]" : "size-[7vmin]"} rounded-[1.2vmin]`} />
                    <div className="min-w-0">
                      <p className={`text-display truncate uppercase leading-none ${i === 0 ? "text-[4.2vmin]" : "text-[3.2vmin]"}`}>
                        {e.participant.displayName} · {tableLabel(e.participant.tableNumber)}
                      </p>
                      <p className="truncate text-[1.9vmin] text-ink-300">
                        {e.song.title} · {e.song.artistGuess}
                      </p>
                    </div>
                    {i === 0 ? (
                      <span className="ml-auto shrink-0 rounded-full bg-brand-500 px-[1.5vmin] py-[0.6vmin] text-[1.4vmin] font-bold uppercase tracking-widest text-white">
                        Prepárate
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section className="surface-brand flex flex-col rounded-[2vmin] p-[3vmin]">
            {queue.length > 0 ? <LogoCarousel intervalMs={logoEvery} className="mb-[2vmin] h-[16vmin] w-full" /> : null}
            <p className="eyebrow inline-flex items-center gap-2 text-[1.6vmin]">
              <Trophy className="size-[2vmin]" /> Ranking de la noche
            </p>
            {ranking.length === 0 ? (
              <p className="mt-[2vmin] text-[2vmin] text-ink-300">
                El ranking aparece cuando una presentación reúne {state.settings.minVotesForRanking} votos.
              </p>
            ) : (
              <ol className="mt-[2vmin] flex flex-col gap-[1.2vmin]">
                {ranking.map((e, i) => (
                  <li key={e.request.id} className="flex items-center gap-[1.5vmin]">
                    <span className="text-display w-[5vmin] text-[4.5vmin] text-brand-500">#{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[2.4vmin] font-bold uppercase">
                        {e.participant.displayName} · {tableLabel(e.participant.tableNumber)}
                      </p>
                      <p className="truncate text-[1.7vmin] text-ink-300">{e.song.title}</p>
                    </div>
                    <span className="text-display text-[4vmin] text-gold">{formatRating(e.performance?.finalRating ?? null)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}

      <footer className="mt-[1.5vmin] overflow-hidden whitespace-nowrap border-t border-white/5 pt-[1vmin] text-[1.8vmin] font-bold uppercase tracking-[0.25em] text-ink-400">
        <div className="inline-block animate-marquee">
          {Array.from({ length: 2 }).map((_, i) => (
            <span key={i} className="inline-block pr-[6vmin]">
              Cacho e&apos; Cabra ★ Karaoke Night ★ 1 voto por celular ★ Ranking en vivo ★ Tu mesa puede ser la campeona ★{beat.listening ? " ★ Al ritmo del local" : ""}
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}

function Selfie({ entry, className }: { entry: QueueEntry; className: string }) {
  return entry.participant.selfieUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={entry.participant.selfieUrl} alt="" className={`shrink-0 object-cover shadow-glow ${className}`} />
  ) : (
    <span className={`grid shrink-0 place-items-center bg-ink-800 text-brand-400 ${className}`}>
      <Mic2 className="size-1/2" />
    </span>
  );
}

/** The performance that finished most recently, while its result is still fresh. */
function latestResult(state: SessionState, now: number): QueueEntry | null {
  const recent = state.performances
    .filter((p) => p.endedAt !== null && now - p.endedAt < RESULT_SHOWN_MS)
    .sort((a, b) => b.endedAt! - a.endedAt!)[0];
  if (!recent) return null;
  const r = state.requests.find((x) => x.id === recent.requestId);
  if (!r || r.status !== "COMPLETED") return null;
  return joinEntry(state, r);
}
