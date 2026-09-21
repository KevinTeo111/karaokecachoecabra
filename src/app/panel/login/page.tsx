"use client";

import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { browserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await browserClient().auth.signInWithPassword({ email, password });
    if (error) {
      setError("Correo o contraseña incorrectos");
      setBusy(false);
      return;
    }
    router.replace("/panel/ahora");
    router.refresh();
  };

  return (
    <div className="stage-bg grid min-h-dvh place-items-center p-6">
      <form className="surface w-full max-w-sm rounded-3xl p-8 animate-rise" onSubmit={(e) => void submit(e)}>
        <BrandLogo className="h-14" wordmarkSize="sm" />
        <h1 className="text-display mt-3 text-4xl uppercase">Panel karaoke</h1>
        <p className="mt-1 text-sm text-ink-400">Acceso para animador y dueño.</p>
        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="animador@cachoecabra.cl"
            />
          </div>
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <Button type="submit" size="lg" block className="mt-6" disabled={busy}>
          <LockKeyhole className="size-4" /> {busy ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
