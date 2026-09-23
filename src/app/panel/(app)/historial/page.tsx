"use client";

import { Avatar, EmptyState, SectionTitle } from "@/components/panel/bits";
import { Stars } from "@/components/brand/wordmark";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL } from "@/lib/domain/state-machine";
import { selectHistory, selectRanking, selectTableRanking, useSessionState } from "@/lib/store/hooks";
import { formatRating, tableLabel } from "@/lib/utils";

const TONE = { COMPLETED: "success", SKIPPED: "neutral", REJECTED: "danger", CANCELLED: "neutral" } as const;

export default function HistorialPage() {
  const state = useSessionState();
  const history = selectHistory(state);
  const ranking = selectRanking(state);
  const tableRanking = selectTableRanking(state);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <section>
        <SectionTitle count={history.length}>Historial de la noche</SectionTitle>
        {history.length === 0 ? (
          <EmptyState>Todavía no hay presentaciones terminadas</EmptyState>
        ) : (
          <ul className="surface divide-y divide-white/5 rounded-2xl">
            {history.map((e) => (
              <li key={e.request.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Avatar participant={e.participant} className="size-10 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">
                    {e.participant.displayName} <span className="font-normal text-ink-400">· {tableLabel(e.participant.tableNumber)}</span>
                  </p>
                  <p className="truncate text-sm text-ink-300">
                    {e.song.title} · {e.song.artistGuess}
                  </p>
                  {e.request.rejectReason ? <p className="text-xs text-danger">{e.request.rejectReason}</p> : null}
                </div>
                <Badge tone={TONE[e.request.status as keyof typeof TONE] ?? "neutral"}>{STATUS_LABEL[e.request.status]}</Badge>
                {e.performance?.finalRating !== null && e.performance?.finalRating !== undefined ? (
                  <div className="flex items-center gap-2">
                    <Stars value={e.performance.finalRating} />
                    <span className="text-display text-2xl text-brand-500">{formatRating(e.performance.finalRating)}</span>
                    <span className="text-xs text-ink-400">({e.performance.voteCount})</span>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-6">
        <div>
        <SectionTitle>Ranking</SectionTitle>
        {ranking.length === 0 ? (
          <EmptyState>Mínimo {state.settings.minVotesForRanking} votos por presentación</EmptyState>
        ) : (
          <ol className="surface divide-y divide-white/5 rounded-2xl">
            {ranking.map((e, i) => (
              <li key={e.request.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-8 text-display text-3xl text-brand-500">#{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {e.participant.displayName} · {tableLabel(e.participant.tableNumber)}
                  </p>
                  <p className="truncate text-xs text-ink-400">{e.song.title}</p>
                </div>
                <span className="text-display text-2xl">{formatRating(e.performance?.finalRating ?? null)}</span>
              </li>
            ))}
          </ol>
        )}
        </div>
        <div>
          <SectionTitle>Ranking por mesa</SectionTitle>
          {tableRanking.length === 0 ? (
            <EmptyState>Promedio de las presentaciones de cada mesa que alcanzan el mínimo de votos</EmptyState>
          ) : (
            <ol className="surface divide-y divide-white/5 rounded-2xl">
              {tableRanking.map((t, i) => (
                <li key={t.tableNumber} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-8 text-display text-3xl text-brand-500">#{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">Mesa {t.tableNumber}</p>
                    <p className="text-xs text-ink-400">
                      {t.performances} {t.performances === 1 ? "canción" : "canciones"} · {t.votes} votos
                    </p>
                  </div>
                  <span className="text-display text-2xl">{formatRating(t.rating)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
