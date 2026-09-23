"use client";

import { useEffect, useState } from "react";
import { Wordmark } from "./wordmark";
import { cn } from "@/lib/utils";

/** Transparent PNGs in public/brand. logo1 is the default mark. */
export const LOGOS = ["/brand/logo1.png", "/brand/logo2.png", "/brand/logo3.png", "/brand/logo4.png", "/brand/logo5.png"] as const;
export const LOGO_SRC = LOGOS[0];
export const SELFIE_FRAME_SRC = "/brand/selfie-frame.png";

export function BrandLogo({
  className,
  wordmarkSize = "md",
  index = 0,
}: {
  className?: string;
  wordmarkSize?: "sm" | "md" | "lg";
  index?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Wordmark size={wordmarkSize} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGOS[index % LOGOS.length]}
      alt="Cacho e' Cabra"
      className={cn("h-12 w-auto object-contain", className)}
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}

/**
 * Cycles through the five logos with a crossfade and a pulse on each change.
 * `intervalMs` comes from the beat clock, so the rotation follows the music.
 */
export function LogoCarousel({ intervalMs, className }: { intervalMs: number; className?: string }) {
  const [index, setIndex] = useState(0);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % LOGOS.length);
      setPulse(true);
      window.setTimeout(() => setPulse(false), 260);
    }, Math.max(1200, intervalMs));
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return (
    <div className={cn("relative", className)} aria-label="Cacho e' Cabra">
      {LOGOS.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          draggable={false}
          className={cn(
            "absolute inset-0 m-auto max-h-full max-w-full object-contain transition-[opacity,transform] duration-500 ease-out",
            i === index ? "opacity-100" : "opacity-0",
            i === index && pulse ? "scale-110" : "scale-100",
          )}
        />
      ))}
    </div>
  );
}
