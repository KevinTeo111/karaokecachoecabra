"use client";

import { Trophy } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ScreenHeader, Stars } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { starBreakdown } from "@/lib/domain/rating";
import { joinEntry, useMyEntry, useSessionState } from "@/lib/store/hooks";
import { formatRating, tableLabel } from "@/lib/utils";

export default function ResultadoPage() {
  return (
    <Suspense>
      <Resultado />
    </Suspense>
  );
}

function Resultado() {
  const state = useSessionState();
  const params = useSearchParams();
  const mine = useMyEntry();

  const perfId = params.get("perf");
  const entry = perfId
    ? (() => {
        const p = state.performances.find((x) => x.id === perfId);
        const r = p && state.requests.find((x) => x.id === p.requestId);
        return r ? joinEntry(state, r) : null;
      })()
    : mine;

  const perf = entry?.performance;
  if (!entry || !perf || perf.endedAt === null) {
    return (
      <div className="flex flex-1 flex-col">
        <ScreenHeader title="Resultado" subtitle="Todavía no hay un resultado para mostrar" />
        <div className="mt-auto pt-6">
          <Button variant="secondary" size="lg" block asChild>
            <Link href="/karaoke">Volver al inicio</Link>
          </Button>
        </div>
      </div>
    );
  }

  const votes = state.votes.filter((v) => v.performanceId === perf.id);
  const breakdown = starBreakdown(votes);
  const isMine = mine?.request.id === entry.request.id;

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Resultado" />

      <div className="my-8 text-center animate-rise">
        {perf.finalRating === null ? (
          <p className="text-display text-4xl uppercase text-ink-300">Sin votos</p>
        ) : (
          <>
            <p className="text-display inline-flex items-baseline gap-2 text-[5.5rem] leading-none text-brand-500">
              <span aria-hidden className="text-5xl">★</span>
              {formatRating(perf.finalRating)}
            </p>
            <Stars value={perf.finalRating} className="mt-2 justify-center" size="size-5" />
          </>
        )}
        <p className="mt-2 text-sm text-ink-400">
          {perf.voteCount} {perf.voteCount === 1 ? "voto" : "votos"}
        </p>
      </div>

      <div className="surface rounded-2xl p-5 text-center">
        <p className="font-bold uppercase tracking-wider">
          {entry.participant.displayName} · {tableLabel(entry.participant.tableNumber)}
        </p>
        <p className="mt-1 text-xs text-ink-400">
          {entry.song.title} · {entry.song.artistGuess}
        </p>
        <div className="mt-4 flex justify-center gap-6 text-sm">
          {([5, 4, 3] as const).map((n) => (
            <span key={n} className="inline-flex items-center gap-1 tabular-nums">
              <span className="text-brand-500">{"★".repeat(n)}</span>
              <span className="font-bold">{breakdown[n]}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="surface-brand mt-4 rounded-2xl p-5 text-center animate-rise">
        <p className="inline-flex items-center gap-2 text-xs text-ink-300">
          <Trophy className="size-4 text-brand-400" /> Ranking de la noche
        </p>
        {perf.rank ? (
          <p className="text-display mt-1 text-5xl text-brand-400">#{perf.rank}</p>
        ) : (
          <p className="mt-2 text-sm text-ink-300">
            Se necesitan al menos {state.settings.minVotesForRanking} votos para entrar al ranking.
          </p>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-3 pt-6">
        <Button size="lg" block asChild>
          <Link href="/karaoke/buscar">{isMine ? "Cantar otra" : "Pedir mi canción"}</Link>
        </Button>
        <Button variant="secondary" size="lg" block asChild>
          <Link href="/karaoke">Volver al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
