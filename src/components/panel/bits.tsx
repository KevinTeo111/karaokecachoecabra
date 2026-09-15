"use client";

import { Mic2 } from "lucide-react";
import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Participant } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function Avatar({ participant, className }: { participant: Participant; className?: string }) {
  return participant.selfieUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={participant.selfieUrl} alt="" className={cn("size-12 shrink-0 rounded-xl object-cover", className)} />
  ) : (
    <span className={cn("grid size-12 shrink-0 place-items-center rounded-xl bg-ink-700 text-brand-400", className)}>
      <Mic2 className="size-5" />
    </span>
  );
}

export function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <h2 className="eyebrow mb-3 flex items-center gap-2">
      {children}
      {count !== undefined ? <span className="text-ink-400">· {count}</span> : null}
    </h2>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="surface rounded-2xl p-6 text-center text-sm text-ink-400">{children}</p>;
}

/** Button that asks for confirmation before running `onConfirm` (spec §6.11). */
export function ConfirmButton({
  title,
  description,
  confirmLabel = "Confirmar",
  onConfirm,
  children,
  ...button
}: ButtonProps & {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button {...button} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={title} description={description}>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Volver
            </Button>
            <Button
              variant={button.variant === "danger" ? "danger" : "primary"}
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ActionError({ message }: { message: string | null }) {
  return message ? <p className="mt-2 text-xs text-danger">{message}</p> : null;
}
