"use client";

import { useState } from "react";
import { Wordmark } from "./wordmark";
import { cn } from "@/lib/utils";

/** Path of the venue logo (transparent PNG or SVG). Falls back to the text wordmark until it exists. */
export const LOGO_SRC = "/brand/logo.png";

export function BrandLogo({ className, wordmarkSize = "md" }: { className?: string; wordmarkSize?: "sm" | "md" | "lg" }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Wordmark size={wordmarkSize} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_SRC}
      alt="Cacho e' Cabra"
      className={cn("h-12 w-auto object-contain", className)}
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}
