"use client";

import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

/** UI only. Supabase Auth wires in at development Step 3. */
export default function LoginPage() {
  const router = useRouter();
  return (
    <div className="stage-bg grid min-h-dvh place-items-center p-6">
      <form
        className="surface w-full max-w-sm rounded-3xl p-8 animate-rise"
        onSubmit={(e) => {
          e.preventDefault();
          router.replace("/panel/ahora");
        }}
      >
        <Wordmark size="sm" />
        <h1 className="text-display mt-1 text-4xl uppercase">Panel karaoke</h1>
        <p className="mt-1 text-sm text-ink-400">Acceso para animador y dueño.</p>
        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Correo</Label>
            <Input id="email" type="email" autoComplete="username" required placeholder="animador@cachoecabra.cl" />
          </div>
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" autoComplete="current-password" required />
          </div>
        </div>
        <Button type="submit" size="lg" block className="mt-6">
          <LockKeyhole className="size-4" /> Entrar
        </Button>
      </form>
    </div>
  );
}
