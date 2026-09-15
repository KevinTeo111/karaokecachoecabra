"use client";

import { Bell, Hourglass, Mic2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ScreenHeader } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL } from "@/lib/domain/state-machine";
import type { QueueEntry } from "@/lib/domain/types";
import { useDispatch, useMyEntry, useQueuePosition, useSessionState } from "@/lib/store/hooks";
import { formatMinutes } from "@/lib/utils";

export default function FilaPage() {
  const router = useRouter();
  const mine = useMyEntry();
  const { settings } = useSessionState();
  const position = useQueuePosition(mine?.request.id);
  const status = mine?.request.status;

  useEffect(() => {
    if (mine === null) return;
    if (status === "PLAYING") router.replace("/karaoke/cantando");
    if (status === "COMPLETED") router.replace("/karaoke/resultado");
  }, [mine, status, router]);

  if (!mine) return <Empty />;

  switch (status) {
    case "PENDING":
      return <Pending entry={mine} />;
    case "QUEUED":
    case "CALLED": {
      const ahead = position?.ahead ?? 0;
      if (status === "CALLED") return <Called entry={mine} />;
      if (ahead <= settings.prepareNoticeSongs) return <Prepare entry={mine} ahead={ahead} />;
      return <Queued entry={mine} ahead={ahead} waitSec={position?.waitSec ?? 0} />;
    }
    case "REJECTED":
    case "CANCELLED":
    case "SKIPPED":
      return <Closed entry={mine} />;
    default:
      return null;
  }
}

function Empty() {
  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Sin solicitud" subtitle="Todavía no has pedido una canción" />
      <div className="mt-auto">
        <Button size="lg" block asChild>
          <Link href="/karaoke/buscar">Buscar canción</Link>
        </Button>
      </div>
    </div>
  );
}

function SongSummary({ entry }: { entry: QueueEntry }) {
  return (
    <div className="surface rounded-2xl p-4 animate-rise">
      <p className="flex items-center gap-2 font-bold">
        <Mic2 className="size-4 text-brand-400" /> {entry.song.title}
      </p>
      <p className="mt-1 text-xs text-ink-400">
        {entry.song.artistGuess} · {entry.participant.displayName} · Mesa {entry.participant.tableNumber}
      </p>
      <Badge tone={entry.request.status === "CALLED" ? "brand" : "success"} className="mt-3">
        Estado: {STATUS_LABEL[entry.request.status]}
      </Badge>
    </div>
  );
}

function CancelButton({ entry }: { entry: QueueEntry }) {
  const dispatch = useDispatch();
  return (
    <button
      type="button"
      onClick={() => {
        if (window.confirm("¿Cancelar tu solicitud?")) dispatch({ type: "request/cancel", requestId: entry.request.id });
      }}
      className="mx-auto mt-6 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-ink-400 hover:text-danger"
    >
      <XCircle className="size-4" /> Cancelar solicitud
    </button>
  );
}

function Pending({ entry }: { entry: QueueEntry }) {
  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Enviada" subtitle="El animador está revisando tu canción" />
      <div className="my-10 flex justify-center">
        <span className="grid size-24 place-items-center rounded-full bg-ink-800 text-brand-400 ring-1 ring-brand-500/40">
          <Hourglass className="size-9 animate-float" />
        </span>
      </div>
      <SongSummary entry={entry} />
      <p className="mt-4 text-center text-sm text-ink-400">Te avisamos aquí mismo cuando sea aprobada.</p>
      <CancelButton entry={entry} />
    </div>
  );
}

function Queued({ entry, ahead, waitSec }: { entry: QueueEntry; ahead: number; waitSec: number }) {
  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Estás en la fila" subtitle="Tu canción fue aprobada" />
      <div className="my-8 text-center animate-rise">
        <p className="text-display text-[7rem] leading-none text-brand-500 tabular-nums">{ahead}</p>
        <p className="font-bold">{ahead === 1 ? "persona antes que tú" : "personas antes que tú"}</p>
        <p className="mt-1 text-sm text-ink-400">Tiempo estimado: {formatMinutes(waitSec)}</p>
      </div>
      <SongSummary entry={entry} />
      <div className="surface mt-4 flex gap-3 rounded-2xl p-4 text-sm text-ink-300">
        <Bell className="mt-0.5 size-4 shrink-0 text-brand-400" />
        <p>Mantén esta pantalla abierta. Te avisaremos cuando falten 2 canciones.</p>
      </div>
      <CancelButton entry={entry} />
    </div>
  );
}

function Prepare({ entry, ahead }: { entry: QueueEntry; ahead: number }) {
  useEffect(() => {
    navigator.vibrate?.([120, 60, 120]);
  }, []);
  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader
        title="¡Prepárate!"
        subtitle={ahead === 0 ? "Eres el siguiente" : ahead === 1 ? "Falta 1 canción" : `Faltan ${ahead} canciones`}
      />
      <div className="my-10 flex justify-center">
        <span className="relative grid size-28 place-items-center">
          <span className="absolute inset-0 rounded-full border-2 border-brand-500/50 animate-pulse-ring" />
          <span className="grid size-20 place-items-center rounded-full bg-brand-500 text-ink-950 shadow-glow">
            <Bell className="size-8" />
          </span>
        </span>
      </div>
      <p className="text-center text-lg font-bold leading-snug">
        {entry.participant.displayName}, acércate a una zona donde puedas cantar cómodo. Tu canción viene pronto.
      </p>
      <div className="surface-brand mt-8 rounded-2xl p-5 text-center">
        <p className="text-display text-3xl uppercase">{entry.song.title}</p>
        <p className="mt-1 text-xs text-ink-300">
          {entry.song.artistGuess} · Mesa {entry.participant.tableNumber}
        </p>
      </div>
    </div>
  );
}

function Called({ entry }: { entry: QueueEntry }) {
  useEffect(() => {
    navigator.vibrate?.([200, 80, 200, 80, 400]);
  }, []);
  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="¡Te toca!" subtitle="El animador te está llamando" />
      <div className="my-10 flex justify-center">
        <span className="relative grid size-32 place-items-center">
          <span className="absolute inset-0 rounded-full border-2 border-brand-500/60 animate-pulse-ring" />
          <span className="absolute inset-2 rounded-full border-2 border-brand-500/40 animate-pulse-ring [animation-delay:0.6s]" />
          <span className="grid size-24 place-items-center rounded-full bg-brand-500 text-ink-950 shadow-glow">
            <Mic2 className="size-10" />
          </span>
        </span>
      </div>
      <p className="text-center text-xl font-bold">Sube al escenario, {entry.participant.displayName}.</p>
      <p className="mt-2 text-center text-sm text-ink-400">
        Cuando empiece el video, tu celular se convierte en tu monitor personal.
      </p>
      <div className="mt-8">
        <SongSummary entry={entry} />
      </div>
    </div>
  );
}

function Closed({ entry }: { entry: QueueEntry }) {
  const status = entry.request.status;
  const title = status === "REJECTED" ? "No aprobada" : status === "SKIPPED" ? "Turno saltado" : "Cancelada";
  const text =
    status === "REJECTED"
      ? entry.request.rejectReason || "El animador no aprobó esta versión. Prueba con otra."
      : status === "SKIPPED"
        ? "El animador pasó al siguiente turno. Puedes pedir otra canción."
        : "Tu solicitud fue cancelada.";
  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title={title} subtitle={text} />
      <div className="mt-8">
        <SongSummary entry={entry} />
      </div>
      <div className="mt-auto pt-6">
        <Button size="lg" block asChild>
          <Link href="/karaoke/buscar">Buscar otra canción</Link>
        </Button>
      </div>
    </div>
  );
}
