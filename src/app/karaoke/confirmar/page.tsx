"use client";

import { Download, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ScreenHeader } from "@/components/brand/wordmark";
import { SongThumb } from "@/components/client/song-card";
import { Button } from "@/components/ui/button";
import { saveSelfie } from "@/lib/selfie/frame";
import { useDraft } from "@/lib/store/draft";
import { useDispatch, useHydrated, useSessionState } from "@/lib/store/hooks";
import { formatDuration, tableLabel } from "@/lib/utils";

export default function ConfirmarPage() {
  const router = useRouter();
  const { draft, clear } = useDraft();
  const { session } = useSessionState();
  const dispatch = useDispatch();
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const submitted = useRef(false);

  const hydrated = useHydrated();
  const song = draft.song;
  const complete = song && draft.displayName.trim() && draft.tableNumber && draft.selfieUrl && draft.consent;

  useEffect(() => {
    if (hydrated && !complete && !submitted.current) router.replace("/karaoke/datos");
  }, [hydrated, complete, router]);

  if (!song || !complete) return null;

  const submit = async () => {
    setSending(true);
    const err = await dispatch({
      type: "request/create",
      songId: song.id,
      displayName: draft.displayName.trim(),
      tableNumber: Number(draft.tableNumber),
      selfieDataUrl: draft.selfieUrl!,
    });
    if (err) {
      setError(err);
      setSending(false);
      return;
    }
    // Navigate first, then clear the draft: clearing re-renders this page and its guard would bounce to /datos.
    submitted.current = true;
    router.replace("/karaoke/fila");
    window.setTimeout(clear, 500);
  };

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Confirma tu canción" />

      <div className="surface mt-8 overflow-hidden rounded-2xl animate-rise">
        <div className="flex gap-4 p-4">
          <SongThumb song={song} className="w-32" />
          <div className="min-w-0">
            <h2 className="text-display truncate text-3xl uppercase">{song.title}</h2>
            <p className="truncate text-sm text-ink-400">{song.artistGuess}</p>
          </div>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t border-white/5 px-4 py-4 text-sm">
          <dt className="text-ink-400">Versión</dt>
          <dd className="font-bold">{song.channelTitle}</dd>
          <dt className="text-ink-400">Cantante</dt>
          <dd className="font-bold">
            {draft.displayName.trim()} · {tableLabel(Number(draft.tableNumber))}
          </dd>
          <dt className="text-ink-400">Duración</dt>
          <dd className="font-bold tabular-nums">{formatDuration(song.durationSec)}</dd>
        </dl>
        <div className="flex items-center gap-3 border-t border-white/5 px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={draft.selfieUrl!} alt="" className="h-16 w-auto rounded-lg object-contain" />
          <p className="flex-1 text-xs text-ink-400">Tu foto con marco se mostrará en la TV durante tu turno.</p>
          <Button variant="outline" size="sm" onClick={() => void saveSelfie(draft.selfieUrl!)}>
            <Download className="size-4" /> Guardar
          </Button>
        </div>
      </div>

      <div className="surface-brand mt-4 flex gap-3 rounded-2xl p-4 text-sm text-ink-200">
        <Info className="mt-0.5 size-4 shrink-0 text-brand-400" />
        <p>Al enviar, entrarás a la cola. El animador puede aprobar o rechazar versiones.</p>
      </div>

      {error ? <p className="mt-3 text-center text-sm text-danger">{error}</p> : null}

      <div className="mt-auto pt-6">
        <Button size="lg" block onClick={() => void submit()} disabled={sending || session.status !== "OPEN"}>
          {sending ? "Enviando…" : session.status === "OPEN" ? "Enviar al karaoke" : "Karaoke cerrado"}
        </Button>
      </div>
    </div>
  );
}
