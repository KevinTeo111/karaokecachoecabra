"use client";

import { Camera, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ScreenHeader, Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useDraft } from "@/lib/store/draft";
import { useHydrated } from "@/lib/store/hooks";

export default function DatosPage() {
  const router = useRouter();
  const { draft, update } = useDraft();
  const hydrated = useHydrated();

  useEffect(() => {
    if (hydrated && !draft.songId) router.replace("/karaoke/buscar");
  }, [hydrated, draft.songId, router]);

  const name = draft.displayName.trim();
  const table = Number(draft.tableNumber);
  const valid = name.length >= 2 && name.length <= 24 && Number.isInteger(table) && table >= 1 && table <= 200;
  const ready = valid && draft.selfieUrl !== null;

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Tu participación" subtitle="Confirma quién va a cantar" />

      <form
        className="mt-8 flex flex-1 flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) router.push("/karaoke/confirmar");
        }}
      >
        <div>
          <Label htmlFor="name">Nombre / apodo</Label>
          <Input
            id="name"
            value={draft.displayName}
            onChange={(e) => update({ displayName: e.target.value })}
            placeholder="Como te anunciará el animador"
            maxLength={24}
            autoComplete="nickname"
          />
        </div>
        <div>
          <Label htmlFor="table">Número de mesa</Label>
          <Input
            id="table"
            value={draft.tableNumber}
            onChange={(e) => update({ tableNumber: e.target.value.replace(/\D/g, "").slice(0, 3) })}
            placeholder="Ej. 8"
            inputMode="numeric"
          />
        </div>

        <div>
          <Label>Selfie del cantante</Label>
          <Link
            href="/karaoke/selfie"
            className="group relative block aspect-[4/3] overflow-hidden rounded-2xl border-2 border-dashed border-brand-500/60 bg-ink-800 transition hover:border-brand-400"
          >
            {draft.selfieUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={draft.selfieUrl} alt="Tu selfie" className="size-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-ink-950/70 py-2 text-[0.7rem] font-bold uppercase tracking-widest text-ink-100">
                  <RefreshCw className="size-3" /> Repetir
                </span>
              </>
            ) : (
              <span className="flex size-full flex-col items-center justify-center gap-3">
                <Wordmark size="sm" />
                <span className="grid size-14 place-items-center rounded-full bg-brand-500/15 text-brand-400 ring-1 ring-brand-500/40 transition group-hover:bg-brand-500 group-hover:text-ink-950">
                  <Camera className="size-6" />
                </span>
                <span className="text-sm font-bold">Tomar selfie</span>
              </span>
            )}
          </Link>
          <p className="mt-2 text-xs text-ink-400">Se muestra en la TV durante tu turno y se borra después.</p>
        </div>

        <div className="mt-auto pt-2">
          <Button type="submit" size="lg" block disabled={!ready}>
            Continuar
          </Button>
        </div>
      </form>
    </div>
  );
}
