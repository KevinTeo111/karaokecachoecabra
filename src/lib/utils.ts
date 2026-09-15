import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(totalSec: number) {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function formatMinutes(totalSec: number) {
  const m = Math.max(1, Math.round(totalSec / 60));
  return `${m} min`;
}

export function formatRating(value: number | null) {
  if (value === null) return "—";
  return value.toFixed(1).replace(".", ",");
}

export function uid(prefix = "") {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix ? `${prefix}_${raw}` : raw;
}
