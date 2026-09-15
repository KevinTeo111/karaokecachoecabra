import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.16em]",
  {
    variants: {
      tone: {
        neutral: "border-white/10 bg-white/5 text-ink-300",
        brand: "border-brand-500/40 bg-brand-500/15 text-brand-400",
        success: "border-success/40 bg-success/10 text-success",
        danger: "border-danger/40 bg-danger/10 text-danger",
        info: "border-info/40 bg-info/10 text-info",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2", className)}>
      <span className="absolute inline-flex size-full rounded-full bg-success opacity-75 animate-ping" />
      <span className="relative inline-flex size-2 rounded-full bg-success" />
    </span>
  );
}
