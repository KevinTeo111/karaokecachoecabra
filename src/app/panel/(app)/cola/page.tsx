"use client";

import { ArrowDown, ArrowUp, PhoneCall, Play, Replace, XCircle } from "lucide-react";
import { useState } from "react";
import { ActionError, Avatar, ConfirmButton, EmptyState, SectionTitle } from "@/components/panel/bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { STATUS_LABEL } from "@/lib/domain/state-machine";
import type { QueueEntry } from "@/lib/domain/types";
import { searchCatalog } from "@/lib/search/normalize";
import { selectPlaying, selectQueue, useDispatch, useSessionState } from "@/lib/store/hooks";
import { formatDuration } from "@/lib/utils";

export default function ColaPage() {
  const state = useSessionState();
  const dispatch = useDispatch();
  const queue = selectQueue(state);
  const playing = selectPlaying(state);
  const [error, setError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<QueueEntry | null>(null);
  const [q, setQ] = useState("");

  const run = (action: Parameters<typeof dispatch>[0]) => setError(dispatch(action));

  const move = (index: number, delta: number) => {
    const ids = queue.map((e) => e.request.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    run({ type: "queue/reorder", orderedIds: ids });
  };

  const replacements = q.trim().length >= 3 ? searchCatalog(state.songs, q, 6) : [];

  return (
    <section className="max-w-4xl">
      <SectionTitle count={queue.length}>Cola</SectionTitle>
      <ActionError message={error} />
      {queue.length === 0 ? (
        <EmptyState>La cola está vacía. Aprueba solicitudes en Pendientes.</EmptyState>
      ) : (
        <ol className="surface divide-y divide-white/5 rounded-2xl">
          {queue.map((e, i) => (
            <li key={e.request.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded p-0.5 text-ink-400 hover:text-ink-100 disabled:opacity-20"
                  aria-label="Subir"
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === queue.length - 1}
                  className="rounded p-0.5 text-ink-400 hover:text-ink-100 disabled:opacity-20"
                  aria-label="Bajar"
                >
                  <ArrowDown className="size-4" />
                </button>
              </div>
              <span className="w-6 text-display text-3xl text-brand-500">{i + 1}</span>
              <Avatar participant={e.participant} className="size-11 rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">
                  {e.participant.displayName} <span className="font-normal text-ink-400">· Mesa {e.participant.tableNumber}</span>
                </p>
                <p className="truncate text-sm text-ink-300">
                  {e.song.title} · {e.song.artistGuess}{" "}
                  <span className="text-xs tabular-nums text-ink-400">{formatDuration(e.song.durationSec)}</span>
                </p>
              </div>
              <Badge tone={e.request.status === "CALLED" ? "brand" : "neutral"}>{STATUS_LABEL[e.request.status]}</Badge>
              <div className="flex flex-wrap gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => setReplacing(e)} title="Reemplazar video">
                  <Replace className="size-4" />
                </Button>
                {e.request.status === "QUEUED" ? (
                  <Button variant="secondary" size="sm" onClick={() => run({ type: "queue/call", requestId: e.request.id })}>
                    <PhoneCall className="size-4" /> Llamar
                  </Button>
                ) : null}
                <Button size="sm" disabled={!!playing} onClick={() => run({ type: "performance/start", requestId: e.request.id })}>
                  <Play className="size-4" /> Iniciar
                </Button>
                <ConfirmButton
                  variant="danger"
                  size="sm"
                  title="Cancelar solicitud"
                  description={`${e.participant.displayName} saldrá de la cola y verá el aviso en su celular.`}
                  confirmLabel="Cancelar solicitud"
                  onConfirm={() => run({ type: "request/cancel", requestId: e.request.id })}
                >
                  <XCircle className="size-4" />
                </ConfirmButton>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Dialog open={replacing !== null} onOpenChange={(o) => !o && setReplacing(null)}>
        {replacing ? (
          <DialogContent
            title="Reemplazar video"
            description={`${replacing.participant.displayName} conserva su lugar en la cola. Actual: ${replacing.song.title}.`}
          >
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar otra versión…" />
            <ul className="mt-3 max-h-64 divide-y divide-white/5 overflow-y-auto">
              {replacements.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      run({ type: "request/replaceSong", requestId: replacing.request.id, songId: s.id });
                      setReplacing(null);
                      setQ("");
                    }}
                    className="flex w-full items-center justify-between gap-3 px-1 py-2 text-left text-sm hover:text-brand-400"
                  >
                    <span className="truncate">
                      {s.title} <span className="text-ink-400">· {s.channelTitle}</span>
                    </span>
                    <span className="text-xs tabular-nums text-ink-400">{formatDuration(s.durationSec)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
}
