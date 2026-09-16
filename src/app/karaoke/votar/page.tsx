"use client";

import { Check, Mic2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ScreenHeader, StarIcon } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import type { Vote } from "@/lib/domain/types";
import { selectPlaying, useDispatch, useSessionState } from "@/lib/store/hooks";
import { cn } from "@/lib/utils";

const LABELS = ["", "Ánimo", "Bien", "Muy bien", "Excelente", "¡Ídolo!"];

export default function VotarPage() {
  const router = useRouter();
  const state = useSessionState();
  const dispatch = useDispatch();
  const playing = selectPlaying(state);
  const [stars, setStars] = useState<Vote["stars"] | 0>(0);
  const [error, setError] = useState<string | null>(null);

  const isMe = playing?.participant.mine === true;
  useEffect(() => {
    if (isMe) router.replace("/karaoke/cantando");
  }, [isMe, router]);

  if (!playing || !playing.performance) {
    return (
      <div className="flex flex-1 flex-col">
        <ScreenHeader title="Vota al cantante" subtitle="Nadie está cantando en este momento" />
        <div className="surface mt-10 rounded-2xl p-6 text-center">
          <Mic2 className="mx-auto size-6 text-brand-400" />
          <p className="mt-3 text-sm text-ink-300">Cuando alguien suba al escenario, podrás calificarlo desde aquí.</p>
        </div>
        <div className="mt-auto pt-6">
          <Button variant="secondary" size="lg" block asChild>
            <Link href="/karaoke">Volver al inicio</Link>
          </Button>
        </div>
      </div>
    );
  }

  const perfId = playing.performance.id;
  const myVote = state.votes.find((v) => v.performanceId === perfId && v.mine);

  const submit = async () => {
    if (!stars) return;
    setError(await dispatch({ type: "vote/cast", performanceId: perfId, stars }));
  };

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Vota al cantante" subtitle="Disponible para las demás mesas" />

      <div className="surface mt-8 flex flex-col items-center rounded-2xl p-6 text-center animate-rise">
        {playing.participant.selfieUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={playing.participant.selfieUrl} alt="" className="size-24 rounded-2xl object-cover shadow-glow" />
        ) : (
          <span className="grid size-24 place-items-center rounded-2xl bg-ink-700 text-brand-400">
            <Mic2 className="size-8" />
          </span>
        )}
        <p className="text-display mt-4 text-3xl uppercase">{playing.participant.displayName}</p>
        <p className="text-xs text-ink-400">Mesa {playing.participant.tableNumber}</p>
        <p className="mt-3 text-sm font-bold">
          {playing.song.title} · {playing.song.artistGuess}
        </p>

        <div className="mt-6 flex gap-2" role="radiogroup" aria-label="Estrellas">
          {([1, 2, 3, 4, 5] as const).map((n) => {
            const active = (myVote?.stars ?? stars) >= n;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={(myVote?.stars ?? stars) === n}
                disabled={!!myVote}
                onClick={() => setStars(n)}
                className={cn(
                  "grid size-12 place-items-center rounded-full transition active:scale-90",
                  active ? "text-brand-500 drop-shadow-[0_0_12px_rgb(242_169_59/0.6)]" : "text-ink-600",
                )}
              >
                <StarIcon className="size-9" />
              </button>
            );
          })}
        </div>
        <p className="mt-2 h-5 text-sm font-bold text-brand-400">{LABELS[myVote?.stars ?? stars]}</p>
      </div>

      {myVote ? (
        <div className="surface-brand mt-6 flex items-center gap-3 rounded-2xl p-4 animate-rise">
          <span className="grid size-8 place-items-center rounded-full bg-brand-500 text-ink-950">
            <Check className="size-4" />
          </span>
          <p className="text-sm">¡Voto enviado! El promedio se revela cuando termine la canción.</p>
        </div>
      ) : (
        <>
          <p className="mt-6 text-center font-bold">¿Cómo estuvo la presentación?</p>
          {error ? <p className="mt-2 text-center text-sm text-danger">{error}</p> : null}
          <div className="mt-4">
            <Button size="lg" block disabled={!stars} onClick={() => void submit()}>
              Enviar voto
            </Button>
            <p className="mt-2 text-center text-xs text-ink-400">1 voto por dispositivo · voto anónimo</p>
          </div>
        </>
      )}
    </div>
  );
}
