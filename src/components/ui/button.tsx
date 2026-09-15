import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-bold tracking-wide whitespace-nowrap transition-[transform,background-color,box-shadow,opacity] duration-200 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-500 text-ink-950 shadow-glow hover:bg-brand-400 uppercase text-[0.8rem] tracking-[0.18em]",
        secondary:
          "bg-ink-700 text-ink-100 border border-white/10 hover:bg-ink-600 uppercase text-[0.8rem] tracking-[0.18em]",
        ghost: "text-ink-200 hover:bg-white/5",
        outline:
          "border border-brand-500/50 text-brand-400 hover:bg-brand-500/10 uppercase text-[0.8rem] tracking-[0.18em]",
        danger: "bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25 uppercase text-[0.8rem] tracking-[0.18em]",
        success: "bg-success/15 text-success border border-success/40 hover:bg-success/25 uppercase text-[0.8rem] tracking-[0.18em]",
      },
      size: {
        sm: "h-9 px-4",
        md: "h-11 px-6",
        lg: "h-14 px-8 text-[0.9rem]",
        icon: "size-10",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, block, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}
