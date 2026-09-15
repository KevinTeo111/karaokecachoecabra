import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-2xl border border-white/10 bg-ink-800 px-4 text-base text-ink-100 placeholder:text-ink-400 transition-[border-color,box-shadow] focus:border-brand-500/60 focus:outline-none focus:ring-4 focus:ring-brand-500/15 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-2 block text-[0.72rem] font-bold uppercase tracking-[0.18em] text-ink-300", className)}
      {...props}
    />
  );
}
