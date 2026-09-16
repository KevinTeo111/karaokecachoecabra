"use client";

import { WifiOff } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store/hooks";

/** Renders children only once the session snapshot is loaded. */
export function SessionGate({ children }: { children: React.ReactNode }) {
  const { state, error } = useStore();
  if (state) return <>{children}</>;
  return (
    <div className="stage-bg grid min-h-dvh place-items-center p-6 text-center">
      <div className="animate-rise">
        <Wordmark />
        {error ? (
          <>
            <WifiOff className="mx-auto mt-6 size-8 text-brand-400" />
            <p className="mt-3 font-bold">No pudimos conectar</p>
            <p className="mt-1 text-sm text-ink-400">{error}</p>
            <Button className="mt-6" variant="outline" onClick={() => window.location.reload()}>
              Reintentar
            </Button>
          </>
        ) : (
          <>
            <div className="mx-auto mt-6 size-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <p className="mt-4 text-sm text-ink-400">Conectando…</p>
          </>
        )}
      </div>
    </div>
  );
}
