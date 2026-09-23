"use client";

import { Pause, Play, PhoneCall, SkipForward, Square, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ActionError, Avatar, ConfirmButton, EmptyState, SectionTitle } from "@/components/panel/bits";
import { SongThumb } from "@/components/client/song-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL } from "@/lib/domain/state-machine";
import {
  selectPending,
  selectPlaying,
  selectQueue,
  selectRanking,
  useDispatch,
  useServerNow,
  useSessionState,
} from "@/lib/store/hooks";
import { formatDuration, formatRating, tableLabel } from "@/lib/utils";

export default function AhoraPage() {
  const state = useSessionState();
  const dispatch = useDispatch();
  const now = useServerNow(1000);
  const [error, setError] = useState<string | null>(null);
  const playing = selectPlaying(state);
  const queue = selectQueue(state);
  const pending = selectPending(state);
  const ranking = selectRanking(state).slice(0, 3);
  const next = queue[0];

  const run = (action: Parameters<typeof dispatch>[0]) => void dispatch(action).then(setError);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
      <section>
        <SectionTitle>Ahora</SectionTitle>
        {playing && playing.performance ? (
          (() => {
            const p = playing.performance;
            const pos = p.paused ? p.playerTime : p.playerTime + (now - p.tickAt) / 1000;
            const pct = Math.min(100, (pos / playing.song.durationSec) * 100);
            const votes = state.votes.filter((v) => v.performanceId === p.id).length;
            return (
              <div className="surface rounded-2xl p-5 animate-rise">
                <div className="flex items-start gap-4">
                  <Avatar participant={playing.participant} className="size-20 rounded-2xl" />
                  <div className="min-w-0 flex-1">
                    <p className="text-display text-4xl uppercase">
                      {playing.participant.displayName} · {tableLabel(playing.participant.tableNumber)}
                    </p>
                    <p className="text-ink-400">
                      {playing.song.title} · {playing.song.artistGuess}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge tone={p.paused ? "neutral" : "success"}>{p.paused ? "En pausa" : "Reproduciendo"}</Badge>
                      <Badge tone="brand">{votes} votos</Badge>
                    </div>
                  </div>
                  <SongThumb song={playing.song} className="w-40 max-md:hidden" />
                </div>
                <div className="mt-5">
                  <div className="h-2 overflow-hidden rounded-full bg-ink-700">
                    <div
                      className="h-full bg-brand-500 transition-[width] duration-1000 ease-linear"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-xs tabular-nums text-ink-400">
                    <span>{formatDuration(pos)}</span>
                    <span>{formatDuration(playing.song.durationSec)}</span>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {p.paused ? (
                    <Button variant="secondary" onClick={() => run({ type: "performance/resume", performanceId: p.id })}>
                      <Play className="size-4" /> Reanudar
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={() => run({ type: "performance/pause", performanceId: p.id })}>
                      <Pause className="size-4" /> Pausar
                    </Button>
                  )}
                  <ConfirmButton
                    title="Finalizar presentación"
                    description="Se cierran los votos y se publica el resultado en todas las pantallas."
                    confirmLabel="Finalizar"
                    onConfirm={() => run({ type: "performance/finish", performanceId: p.id })}
                  >
                    <Square className="size-4" /> Finalizar
                  </ConfirmButton>
                  <ConfirmButton
                    variant="danger"
                    title="Saltar turno"
                    description="La presentación se marca como saltada y no entra al ranking."
                    confirmLabel="Saltar"
                    onConfirm={() => run({ type: "performance/skip", requestId: playing.request.id })}
                  >
                    <SkipForward className="size-4" /> Saltar
                  </ConfirmButton>
                </div>
                <ActionError message={error} />
              </div>
            );
          })()
        ) : next ? (
          <div className="surface rounded-2xl p-5 animate-rise">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-400">Siguiente en la cola</p>
            <div className="mt-3 flex items-center gap-4">
              <Avatar participant={next.participant} className="size-16 rounded-2xl" />
              <div className="min-w-0 flex-1">
                <p className="text-display text-3xl uppercase">
                  {next.participant.displayName} · {tableLabel(next.participant.tableNumber)}
                </p>
                <p className="text-sm text-ink-400">
                  {next.song.title} · {next.song.artistGuess} · {formatDuration(next.song.durationSec)}
                </p>
                <Badge tone={next.request.status === "CALLED" ? "brand" : "neutral"} className="mt-2">
                  {STATUS_LABEL[next.request.status]}
                </Badge>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {next.request.status === "QUEUED" ? (
                <Button variant="secondary" onClick={() => run({ type: "queue/call", requestId: next.request.id })}>
                  <PhoneCall className="size-4" /> Llamar
                </Button>
              ) : null}
              <Button onClick={() => run({ type: "performance/start", requestId: next.request.id })}>
                <Play className="size-4" /> Iniciar
              </Button>
            </div>
            <ActionError message={error} />
          </div>
        ) : (
          <EmptyState>
            Nadie en la cola.{" "}
            {pending.length > 0 ? (
              <Link href="/panel/pendientes" className="text-brand-400 underline">
                Hay {pending.length} solicitudes por aprobar.
              </Link>
            ) : (
              "Los invitados pueden escanear el QR de su mesa."
            )}
          </EmptyState>
        )}
      </section>

      <section className="grid content-start gap-6">
        <div>
          <SectionTitle count={queue.length}>Cola</SectionTitle>
          {queue.length === 0 ? (
            <EmptyState>Vacía</EmptyState>
          ) : (
            <ol className="surface divide-y divide-white/5 rounded-2xl">
              {queue.slice(0, 6).map((e, i) => (
                <li key={e.request.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-5 text-display text-2xl text-brand-500">{i + 1}</span>
                  <Avatar participant={e.participant} className="size-9 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {e.participant.displayName}{" "}
                      <span className="font-normal text-ink-400">· {tableLabel(e.participant.tableNumber)}</span>
                    </p>
                    <p className="truncate text-xs text-ink-400">{e.song.title}</p>
                  </div>
                  <span className="text-xs tabular-nums text-ink-400">{formatDuration(e.song.durationSec)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div>
          <SectionTitle>Ranking de la noche</SectionTitle>
          {ranking.length === 0 ? (
            <EmptyState>Aún sin presentaciones con votos suficientes</EmptyState>
          ) : (
            <ol className="surface divide-y divide-white/5 rounded-2xl">
              {ranking.map((e, i) => (
                <li key={e.request.id} className="flex items-center gap-3 px-4 py-3">
                  <Trophy className={i === 0 ? "size-4 text-brand-400" : "size-4 text-ink-500"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {e.participant.displayName} · {tableLabel(e.participant.tableNumber)}
                    </p>
                    <p className="truncate text-xs text-ink-400">{e.song.title}</p>
                  </div>
                  <span className="text-display text-2xl text-brand-500">
                    {formatRating(e.performance?.finalRating ?? null)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
