"use client";

import { Copy, RotateCcw, Tv2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ConfirmButton, SectionTitle } from "@/components/panel/bits";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { SessionSettings } from "@/lib/domain/types";
import { useDispatch, useSessionState } from "@/lib/store/hooks";

const TABLES = 20;

export default function ConfiguracionPage() {
  const { settings, session, audit } = useSessionState();
  const dispatch = useDispatch();
  const [copied, setCopied] = useState<number | null>(null);

  const set = <K extends keyof SessionSettings>(key: K, value: SessionSettings[K]) =>
    void dispatch({ type: "session/updateSettings", patch: { [key]: value } });

  const numberField = (key: keyof SessionSettings, label: string, hint: string, min: number, max: number) => (
    <div>
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        min={min}
        max={max}
        value={settings[key] as number}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v) && v >= min && v <= max) set(key, v as never);
        }}
      />
      <p className="mt-1 text-xs text-ink-400">{hint}</p>
    </div>
  );

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const copy = async (table: number) => {
    await navigator.clipboard.writeText(`${origin}/karaoke?table=${table}`);
    setCopied(table);
    window.setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="grid gap-8 xl:grid-cols-2">
      <section className="space-y-5">
        <SectionTitle>Reglas de la noche</SectionTitle>
        {numberField("etaBufferSec", "Buffer entre canciones (s)", "Se suma al ETA por cada cambio de cantante.", 0, 300)}
        {numberField("prepareNoticeSongs", "Aviso «Prepárate» (canciones antes)", "Cuántas canciones antes se avisa al cantante.", 0, 5)}
        {numberField("minVotesForRanking", "Mínimo de votos para ranking", "Presentaciones con menos votos no entran al ranking.", 1, 50)}
        {numberField("maxActiveRequestsPerDevice", "Solicitudes activas por celular", "Cuántas canciones puede tener pendientes o en cola un mismo celular.", 1, 5)}
        <label className="surface flex items-center justify-between gap-4 rounded-2xl p-4">
          <span>
            <span className="block text-sm font-bold">Bloquear voto de la misma mesa</span>
            <span className="block text-xs text-ink-400">Además del auto-voto por dispositivo, nadie de la mesa del cantante puede votar.</span>
          </span>
          <Switch checked={settings.blockSameTableVote} onCheckedChange={(v) => set("blockSameTableVote", v)} />
        </label>
      </section>

      <section className="space-y-6">
        <div>
          <SectionTitle>Pantallas</SectionTitle>
          <Button variant="outline" asChild>
            <Link href={`/tv/${session.id}`} target="_blank">
              <Tv2 className="size-4" /> Abrir TV en otra ventana
            </Link>
          </Button>
          <p className="mt-2 text-xs text-ink-400">Varias TVs pueden abrir la misma ruta y reciben el mismo estado.</p>
        </div>

        <div>
          <SectionTitle>QR por mesa</SectionTitle>
          <p className="mb-3 text-xs text-ink-400">Cada mesa tiene su enlace con la mesa preseleccionada. Los QR impresos se generan en el paso 3 del plan.</p>
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {Array.from({ length: TABLES }, (_, i) => i + 1).map((t) => (
              <li key={t}>
                <button
                  type="button"
                  onClick={() => void copy(t)}
                  className="surface flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-bold hover:border-brand-500/40"
                >
                  Mesa {t}
                  <Copy className={`size-3.5 ${copied === t ? "text-success" : "text-ink-400"}`} />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <SectionTitle count={audit.length}>Auditoría</SectionTitle>
          <ul className="surface max-h-56 divide-y divide-white/5 overflow-y-auto rounded-2xl text-xs">
            {audit.slice(0, 30).map((a) => (
              <li key={a.id} className="flex gap-3 px-4 py-2">
                <span className="tabular-nums text-ink-400">
                  {new Date(a.at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span className="font-bold text-ink-200">{a.action}</span>
                <span className="truncate text-ink-400">{a.detail ?? a.entityId}</span>
              </li>
            ))}
            {audit.length === 0 ? <li className="px-4 py-3 text-ink-400">Sin acciones registradas</li> : null}
          </ul>
        </div>

        <div>
          <SectionTitle>Noche</SectionTitle>
          <ConfirmButton
            variant="danger"
            title="Abrir una noche nueva"
            description="Cierra la noche actual y empieza con cola y ranking vacíos. El historial se conserva. Solo el dueño puede hacerlo."
            confirmLabel="Nueva noche"
            onConfirm={() =>
              void dispatch({
                type: "session/new",
                name: `Karaoke ${new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "short" })}`,
              }).then((e) => e && window.alert(e))
            }
          >
            <RotateCcw className="size-4" /> Nueva noche
          </ConfirmButton>
        </div>
      </section>
    </div>
  );
}
