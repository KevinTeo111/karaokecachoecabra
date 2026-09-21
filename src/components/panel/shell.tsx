"use client";

import { Clock3, History, Inbox, ListOrdered, LogOut, Mic2, Settings2, Tv2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand/logo";
import { Badge, LiveDot } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { selectPending, selectQueue, useDispatch, useSessionState, useStore } from "@/lib/store/hooks";
import { browserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/panel/ahora", label: "Ahora", icon: Mic2 },
  { href: "/panel/pendientes", label: "Pendientes", icon: Inbox },
  { href: "/panel/cola", label: "Cola", icon: ListOrdered },
  { href: "/panel/historial", label: "Historial", icon: History },
  { href: "/panel/configuracion", label: "Configuración", icon: Settings2 },
] as const;

export function PanelShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const state = useSessionState();
  const { connected } = useStore();
  const dispatch = useDispatch();
  const logout = async () => {
    await browserClient().auth.signOut();
    router.replace("/panel/login");
  };
  const pending = selectPending(state).length;
  const queued = selectQueue(state).length;
  const open = state.session.status === "OPEN";

  return (
    <div className="grid min-h-dvh grid-cols-[15rem_1fr] bg-ink-950 text-ink-100 max-lg:grid-cols-1">
      <aside className="flex flex-col border-r border-white/5 bg-ink-900 px-4 py-6 max-lg:hidden">
        <BrandLogo className="h-12 self-start" wordmarkSize="sm" />
        <p className="text-display mt-2 text-3xl uppercase">Panel karaoke</p>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            const count = href.endsWith("pendientes") ? pending : href.endsWith("cola") ? queued : 0;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                  active ? "bg-brand-500/15 text-brand-400" : "text-ink-300 hover:bg-white/5 hover:text-ink-100",
                )}
              >
                <Icon className="size-4" />
                <span className="flex-1">{label}</span>
                {count > 0 ? (
                  <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[0.65rem] font-bold text-ink-950 tabular-nums">
                    {count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <Link
          href={`/tv/${state.session.id}${state.tvKey ? `?k=${encodeURIComponent(state.tvKey)}` : ""}`}
          target="_blank"
          className="mt-auto flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold text-ink-300 hover:bg-white/5 hover:text-ink-100"
        >
          <Tv2 className="size-4" /> Abrir TV
        </Link>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex flex-wrap items-center gap-4 border-b border-white/5 px-6 py-4">
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{state.session.name}</p>
            <p className="inline-flex items-center gap-1.5 text-xs text-ink-400">
              <Clock3 className="size-3" /> {state.session.startsAt}–{state.session.endsAt}
            </p>
          </div>
          <Badge tone={connected ? "success" : "danger"}>
            {connected ? <LiveDot /> : null} {connected ? "Online" : "Offline · sondeando"}
          </Badge>
          <label className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
            <span className={open ? "text-success" : "text-ink-400"}>{open ? "Karaoke abierto" : "Cerrado"}</span>
            <Switch
              checked={open}
              onCheckedChange={(v) => void dispatch({ type: "session/setStatus", status: v ? "OPEN" : "CLOSED" })}
              aria-label="Abrir o cerrar el karaoke"
            />
          </label>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-full p-2 text-ink-400 hover:bg-white/5 hover:text-ink-100"
            aria-label="Cerrar sesión"
          >
            <LogOut className="size-4" />
          </button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-white/5 px-4 py-2 scrollbar-none lg:hidden">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider",
                pathname.startsWith(href) ? "bg-brand-500 text-white" : "text-ink-300",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
