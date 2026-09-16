"use client";

import { Mic2, QrCode, Star, Trophy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { YouTubePlayer, type PlayerHandle } from "@/components/player/youtube-player";
import {
  selectPlaying,
  selectQueue,
  selectRanking,
  useDispatch,
  useSessionState,
} from "@/lib/store/hooks";
import { formatRating } from "@/lib/utils";

const TICK_EVERY_SEC = 5;

/**
 * Stage screen. The player here is the time reference for every phone:
 * it publishes a tick every few seconds and obeys pause/resume from the panel.
 */
export default function TvPage() {
  const state = useSessionState();
  const dispatch = useDispatch();
  const playing = selectPlaying(state);
  const queue = selectQueue(state);
  const ranking = selectRanking(state).slice(0, 5);
  const [armed, setArmed] = useState(false);
  const playerRef = useRef<PlayerHandle>(null);
  const lastTick = useRef(0);
  const perf = playing?.performance ?? null;

  useEffect(() => {
    if (!perf) return;
    if (perf.paused) playerRef.current?.pause();
    else playerRef.current?.play();
  }, [perf?.paused, perf]);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="stage-bg grid h-dvh w-dvw place-items-center text-center"
      >
        <span>
          <Wordmark size="lg" />
          <span className="text-display mt-2 block text-7xl uppercase">Karaoke Night</span>
          <span className="mt-6 inline-block rounded-full bg-brand-500 px-8 py-3 text-sm font-bold uppercase tracking-[0.2em] text-ink-950 shadow-glow">
            Activar pantalla
          </span>
          <span className="mt-3 block text-xs text-ink-400">Un toque habilita el audio en esta TV</span>
        </span>
      </button>
    );
  }

  return (
    <div className="stage-bg flex h-dvh w-dvw flex-col overflow-hidden p-[2vmin] text-ink-100">
      <header className="flex items-center justify-between px-[1vmin] pb-[1.5vmin]">
        <p className="text-display text-[3.2vmin] uppercase tracking-wider text-brand-500">Cacho e&apos; Cabra · Karaoke Night</p>
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
                  void dispatch({ type: "performance/tick", performanceId: perf.id, playerTime: t });
                }
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
            {playing.participant.selfieUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={playing.participant.selfieUrl}
                alt=""
                className="mt-[2vmin] size-[20vmin] rounded-[2vmin] object-cover shadow-glow"
              />
            ) : (
              <span className="mt-[2vmin] grid size-[20vmin] place-items-center rounded-[2vmin] bg-ink-800 text-brand-400">
                <Mic2 className="size-[8vmin]" />
              </span>
            )}
            <p className="text-display mt-[2vmin] text-[4.5vmin] uppercase leading-none">{playing.participant.displayName}</p>
            <p className="text-[2vmin] font-bold text-brand-400">Mesa {playing.participant.tableNumber}</p>
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
          <section className="surface flex flex-col rounded-[2vmin] p-[3vmin]">
            <p className="eyebrow text-[1.6vmin]">Próximos turnos</p>
            {queue.length === 0 ? (
              <div className="grid flex-1 place-items-center text-center">
                <div>
                  <Mic2 className="mx-auto size-[10vmin] text-brand-500 animate-float" />
                  <p className="text-display mt-[2vmin] text-[6vmin] uppercase">La noche es tuya</p>
                  <p className="text-[2vmin] text-ink-300">Escanea el QR, elige tu canción y entra a la fila.</p>
                </div>
              </div>
            ) : (
              <ol className="mt-[2vmin] flex flex-col gap-[1.5vmin]">
                {queue.slice(0, 4).map((e, i) => (
                  <li key={e.request.id} className="flex items-center gap-[2vmin] rounded-[1.5vmin] bg-white/5 p-[1.5vmin]">
                    <span className="text-display w-[4vmin] text-[5vmin] text-brand-500">{i + 1}</span>
                    {e.participant.selfieUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.participant.selfieUrl} alt="" className="size-[8vmin] rounded-[1.2vmin] object-cover" />
                    ) : null}
                    <div className="min-w-0">
                      <p className="text-display truncate text-[3.4vmin] uppercase leading-none">
                        {e.participant.displayName} · Mesa {e.participant.tableNumber}
                      </p>
                      <p className="truncate text-[1.9vmin] text-ink-300">
                        {e.song.title} · {e.song.artistGuess}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section className="surface-brand flex flex-col rounded-[2vmin] p-[3vmin]">
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
                        {e.participant.displayName} · Mesa {e.participant.tableNumber}
                      </p>
                      <p className="truncate text-[1.7vmin] text-ink-300">{e.song.title}</p>
                    </div>
                    <span className="text-display text-[4vmin]">{formatRating(e.performance?.finalRating ?? null)}</span>
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
              Cacho e&apos; Cabra ★ Karaoke Night ★ 1 voto por celular ★ Ranking en vivo ★ Tu mesa puede ser la campeona ★
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}
