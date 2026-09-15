"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { ActionError, Avatar, EmptyState, SectionTitle } from "@/components/panel/bits";
import { SongThumb } from "@/components/client/song-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import type { QueueEntry } from "@/lib/domain/types";
import { selectPending, useDispatch, useSessionState } from "@/lib/store/hooks";
import { formatDuration } from "@/lib/utils";

const REASONS = ["Versión sin letra", "Video no disponible", "Canción repetida esta noche", "Contenido no apto"];

export default function PendientesPage() {
  const state = useSessionState();
  const dispatch = useDispatch();
  const pending = selectPending(state);
  const [rejecting, setRejecting] = useState<QueueEntry | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reject = () => {
    if (!rejecting) return;
    setError(dispatch({ type: "request/reject", requestId: rejecting.request.id, reason: reason.trim() }));
    setRejecting(null);
    setReason("");
  };

  return (
    <section className="max-w-3xl">
      <SectionTitle count={pending.length}>Solicitudes pendientes</SectionTitle>
      <ActionError message={error} />
      {pending.length === 0 ? (
        <EmptyState>Sin solicitudes por revisar</EmptyState>
      ) : (
        <ul className="space-y-3">
          {pending.map((e, i) => (
            <li
              key={e.request.id}
              className="surface flex flex-wrap items-center gap-4 rounded-2xl p-4 animate-rise"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <Avatar participant={e.participant} className="size-14 rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {e.participant.displayName} <span className="font-normal text-ink-400">· Mesa {e.participant.tableNumber}</span>
                </p>
                <p className="truncate text-sm text-ink-300">
                  {e.song.title} · {e.song.artistGuess}
                </p>
                <p className="text-xs text-ink-400">
                  {e.song.channelTitle} · {formatDuration(e.song.durationSec)}
                  {e.song.verified ? " · Verificada" : ""}
                </p>
              </div>
              <SongThumb song={e.song} className="w-32 max-sm:hidden" />
              <div className="flex gap-2">
                <Button variant="danger" size="sm" onClick={() => setRejecting(e)}>
                  <X className="size-4" /> Rechazar
                </Button>
                <Button variant="success" size="sm" onClick={() => setError(dispatch({ type: "request/approve", requestId: e.request.id }))}>
                  <Check className="size-4" /> Aprobar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={rejecting !== null} onOpenChange={(o) => !o && setRejecting(null)}>
        {rejecting ? (
          <DialogContent
            title="Rechazar solicitud"
            description={`${rejecting.participant.displayName} · ${rejecting.song.title}. El invitado verá el motivo en su celular.`}
          >
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`rounded-full border px-3 py-1 text-xs ${reason === r ? "border-brand-500 bg-brand-500/15 text-brand-400" : "border-white/10 text-ink-300"}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <Label htmlFor="reason">Motivo</Label>
              <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRejecting(null)}>
                Volver
              </Button>
              <Button variant="danger" onClick={reject}>
                Rechazar
              </Button>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
}
