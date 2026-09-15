"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-white/10 bg-ink-600 transition-colors data-[state=checked]:bg-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-5 translate-x-1 rounded-full bg-ink-100 shadow transition-transform data-[state=checked]:translate-x-6 data-[state=checked]:bg-ink-950" />
    </SwitchPrimitive.Root>
  );
}
