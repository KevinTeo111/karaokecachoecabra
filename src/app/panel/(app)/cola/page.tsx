"use client";

import { ArrowDown, ArrowUp, Mic2, PhoneCall, Play, Replace, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { ActionError, Avatar, ConfirmButton, EmptyState, SectionTitle } from "@/components/panel/bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { STATUS_LABEL } from "@/lib/domain/state-machine";
import type { QueueEntry, Song } from "@/lib/domain/types";
import { selectPlaying, selectQueue, useDispatch, useSessionState } from "@/lib/store/hooks";
import { formatDuration, tableLabel } from "@/lib/utils";

export default function ColaPage() {
  const state = useSessionState();
  const dispatch = useDispatch();
  const queue = selectQueue(state);
  const playing = selectPlaying(state);
  const [error, setError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<QueueEntry | null>(null);
  const [q, setQ] = useState("");
  const [replacements, setReplacements] = useState<Song[]>([]);
  const [hostQ, setHostQ] = useState("");
  const [hostName, setHostName] = useState("Animador");
  const [hostResults, setHostResults] = useState<Song[]>([]);

  useEffect(() => {
    if (hostQ.trim().length < 3) {
      setHostResults([]);
      return;
    }
    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(hostQ.trim())}`, { signal: controller.signal });
        if (res.ok) setHostResults((await res.json()) as Song[]);
      } catch {
        /* aborted */
      }
    }, 400);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [hostQ]);

  useEffect(() => {
    if (q.trim().length < 3) {
      setReplacements([]);
      return;
    }
    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: controller.signal });
        if (res.ok) setReplacements((await res.json()) as Song[]);
      } catch {
        /* aborted */
      }
    }, 400);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [q]);

  const run = (action: Parameters<typeof dispatch>[0]) => void dispatch(action).then(setError);

  const moveTo = (index: number, target: number) => {
    const ids = queue.map((e) => e.request.id);
    if (target < 0 || target >= ids.length || target === index) return;
    const [id] = ids.splice(index, 1);
    ids.splice(target, 0, id);
    run({ type: "queue/reorder", orderedIds: ids, expectedVersion: state.queueVersion });
  };
  const move = (index: number, delta: number) => moveTo(index, index + delta);

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
              <input
                type="number"
                min={1}
                max={queue.length}
                defaultValue={i + 1}
                key={`${e.request.id}-${i}`}
                title="Escribe la posición y presiona Enter"
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") moveTo(i, Number((ev.target as HTMLInputElement).value) - 1);
                }}
                onBlur={(ev) => {
                  const n = Number(ev.target.value) - 1;
                  if (n !== i) moveTo(i, n);
                }}
                className="text-display w-14 rounded-lg border border-white/10 bg-ink-800 text-center text-2xl text-brand-500 focus:border-brand-500 focus:outline-none"
              />
              <Avatar participant={e.participant} className="size-11 rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">
                  {e.participant.displayName} <span className="font-normal text-ink-400">· {tableLabel(e.participant.tableNumber)}</span>
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

      <form
        className="surface mt-6 rounded-2xl p-4"
        onSubmit={(e) => e.preventDefault()}
      >
        <p className="eyebrow mb-3 inline-flex items-center gap-2">
          <Mic2 className="size-3.5" /> Canción del animador
        </p>
        <div className="grid gap-2 sm:grid-cols-[1fr_12rem]">
          <Input value={hostQ} onChange={(e) => setHostQ(e.target.value)} placeholder="Buscar canción para el animador…" />
          <Input value={hostName} onChange={(e) => setHostName(e.target.value.slice(0, 24))} placeholder="Nombre en pantalla" />
        </div>
        {hostResults.length ? (
          <ul className="mt-2 max-h-56 divide-y divide-white/5 overflow-y-auto">
            {hostResults.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    run({ type: "request/hostAdd", songId: s.id, displayName: hostName.trim() || "Animador" });
                    setHostQ("");
                    setHostResults([]);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-1 py-2 text-left text-sm hover:text-brand-400"
                >
                  <span className="truncate">
                    {s.title} <span className="text-ink-400">· {s.artistGuess || s.channelTitle}</span>
                  </span>
                  <span className="text-xs tabular-nums text-ink-400">{formatDuration(s.durationSec)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-ink-400">Entra directo a la cola, sin selfie ni aprobación. Luego muévela a la posición que quieras.</p>
        )}
      </form>

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
