"use client";

import { Clock, Mic2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useDraft } from "@/lib/store/draft";
import { useMyEntry, useSessionState } from "@/lib/store/hooks";
import { ACTIVE_STATUSES } from "@/lib/domain/types";

export default function InicioPage() {
  return (
    <Suspense>
      <Inicio />
    </Suspense>
  );
}

function Inicio() {
  const { session } = useSessionState();
  const mine = useMyEntry();
  const params = useSearchParams();
  const { update } = useDraft();

  useEffect(() => {
    const table = params.get("table");
    if (table && /^\d{1,3}$/.test(table)) update({ tableNumber: table });
  }, [params, update]);

  const hasActive = mine ? ACTIVE_STATUSES.includes(mine.request.status) : false;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-col items-center text-center animate-rise">
        <BrandLogo className="h-36" wordmarkSize="lg" />
        <h1 className="text-display mt-4 text-5xl uppercase text-ink-100">Karaoke</h1>
        <p className="mt-2 max-w-xs text-sm text-ink-400">Escanea, canta y compite con tu mesa</p>
      </header>

      <div className="my-auto flex flex-col items-center py-10">
        <div className="relative grid size-32 place-items-center">
          <span className="absolute inset-0 rounded-full border border-brand-500/40 animate-pulse-ring" />
          <span className="absolute inset-3 rounded-full border border-brand-500/30 animate-pulse-ring [animation-delay:0.8s]" />
          <span className="grid size-24 place-items-center rounded-full bg-brand-500 text-white shadow-glow animate-float">
            <Mic2 className="size-10" strokeWidth={2.2} />
          </span>
        </div>
        <p className="mt-10 max-w-[18rem] text-center text-lg font-semibold leading-snug text-ink-100">
          La noche es tuya. Busca una canción karaoke y entra a la fila.
        </p>
      </div>

      {session.status === "OPEN" ? (
        <div className="flex flex-col gap-3 animate-rise">
          {hasActive ? (
            <Button size="lg" block asChild>
              <Link href="/karaoke/fila">Ver mi turno</Link>
            </Button>
          ) : (
            <Button size="lg" block asChild>
              <Link href="/karaoke/buscar">Comenzar</Link>
            </Button>
          )}
          <p className="text-center text-xs text-ink-400">No necesitas crear una cuenta</p>
        </div>
      ) : (
        <div className="surface rounded-2xl p-5 text-center animate-rise">
          <Clock className="mx-auto size-6 text-brand-400" />
          <p className="mt-3 font-bold text-ink-100">El karaoke está cerrado</p>
          <p className="mt-1 text-sm text-ink-400">
            Abrimos de {session.startsAt} a {session.endsAt}. Vuelve a escanear cuando empiece la noche.
          </p>
        </div>
      )}
    </div>
  );
}
