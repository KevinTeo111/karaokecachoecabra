"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink-950/80 backdrop-blur-sm" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl surface bg-ink-900 p-6 animate-rise focus:outline-none",
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Title className="text-display text-2xl uppercase text-ink-100">{title}</DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="mt-2 text-sm text-ink-300">{description}</DialogPrimitive.Description>
        ) : null}
        <div className="mt-5">{children}</div>
        <DialogPrimitive.Close
          className="absolute right-4 top-4 rounded-full p-1 text-ink-400 hover:bg-white/5 hover:text-ink-100"
          aria-label="Cerrar"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
