"use client";

import { Link2, RefreshCw, Youtube } from "lucide-react";
import { useState } from "react";
import { ActionError, SectionTitle } from "@/components/panel/bits";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useDispatch, useSessionState } from "@/lib/store/hooks";
import { CATEGORIES } from "@/lib/youtube/categories";

const DAILY_QUOTA = 10_000;

/** Catalog health, YouTube quota, and the host's add-by-URL / add-channel tools. */
export function CatalogSection() {
  const { catalog, settings } = useSessionState();
  const dispatch = useDispatch();
  const [url, setUrl] = useState("");
  const [channel, setChannel] = useState("");
  const [busy, setBusy] = useState<"sync" | "url" | "channel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const run = async (kind: NonNullable<typeof busy>, action: Parameters<typeof dispatch>[0], done: string) => {
    setBusy(kind);
    setError(null);
    setNote(null);
    const err = await dispatch(action);
    setBusy(null);
    if (err) setError(err);
    else {
      setNote(done);
      if (kind === "url") setUrl("");
      if (kind === "channel") setChannel("");
    }
  };

  if (!catalog) return null;
  const quotaPct = Math.min(100, Math.round((catalog.quotaUsedToday / DAILY_QUOTA) * 100));

  return (
    <div className="space-y-5">
      <SectionTitle>Catálogo y YouTube</SectionTitle>

      <div className="surface grid grid-cols-2 gap-4 rounded-2xl p-4 text-sm sm:grid-cols-4">
        <Stat label="Canciones" value={catalog.songs.toLocaleString("es-CL")} />
        <Stat label="Canales" value={String(catalog.channels)} />
        <Stat label="Búsquedas YouTube hoy" value={`${catalog.fallbackSearchesToday} / ${settings.fallbackSearchCapPerNight}`} />
        <Stat
          label="Última sincronización"
          value={catalog.lastSyncAt ? new Date(catalog.lastSyncAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }) : "nunca"}
        />
        <div className="col-span-full">
          <div className="mb-1 flex justify-between text-xs text-ink-400">
            <span>Cuota YouTube hoy</span>
            <span className="tabular-nums">
              {catalog.quotaUsedToday.toLocaleString("es-CL")} / {DAILY_QUOTA.toLocaleString("es-CL")} unidades
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink-700">
            <div className={`h-full ${quotaPct > 80 ? "bg-danger" : "bg-brand-500"}`} style={{ width: `${quotaPct}%` }} />
          </div>
        </div>
        <div className="col-span-full flex flex-wrap gap-2 text-xs">
          {CATEGORIES.map((c) => (
            <span key={c.slug} className="rounded-full border border-white/10 px-2.5 py-1 text-ink-300">
              {c.label} <span className="font-bold text-ink-100 tabular-nums">{catalog.byCategory[c.slug] ?? 0}</span>
            </span>
          ))}
          {catalog.pendingQueries > 0 ? (
            <span className="rounded-full border border-brand-500/40 px-2.5 py-1 text-brand-400">
              {catalog.pendingQueries} búsquedas de categoría pendientes
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Button variant="outline" disabled={busy !== null} onClick={() => void run("sync", { type: "catalog/sync" }, "Sincronización terminada")}>
          <RefreshCw className={`size-4 ${busy === "sync" ? "animate-spin" : ""}`} /> Sincronizar ahora
        </Button>
        <p className="text-xs text-ink-400">Corre automáticamente cada madrugada. Cada ejecución respeta la cuota del día.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <form
          className="surface rounded-2xl p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) void run("url", { type: "song/addByUrl", url: url.trim() }, "Video agregado como verificado");
          }}
        >
          <Label htmlFor="add-url">Agregar video por enlace</Label>
          <div className="flex gap-2">
            <Input id="add-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtu.be/…" />
            <Button type="submit" disabled={busy !== null || !url.trim()} size="md">
              <Link2 className="size-4" /> Agregar
            </Button>
          </div>
          <p className="mt-2 text-xs text-ink-400">Entra al catálogo como verificado y aparece primero en la búsqueda. Cuesta 1 unidad.</p>
        </form>
        <form
          className="surface rounded-2xl p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (channel.trim()) void run("channel", { type: "catalog/addChannel", ref: channel.trim() }, "Canal agregado; se sincroniza en la próxima ejecución");
          }}
        >
          <Label htmlFor="add-channel">Agregar canal de karaoke</Label>
          <div className="flex gap-2">
            <Input id="add-channel" value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="@canal o enlace" />
            <Button type="submit" disabled={busy !== null || !channel.trim()} size="md">
              <Youtube className="size-4" /> Agregar
            </Button>
          </div>
          <p className="mt-2 text-xs text-ink-400">Sus videos se importan al catálogo a 1 unidad por cada 50.</p>
        </form>
      </div>

      <ActionError message={error} />
      {note ? <p className="text-xs text-success">{note}</p> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-400">{label}</p>
      <p className="text-display text-2xl">{value}</p>
    </div>
  );
}
