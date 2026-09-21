import { timingSafeEqual } from "node:crypto";
import { HttpError } from "./http";

/**
 * The stage screen proves it is the venue's TV with TV_KEY, handed to it by
 * the panel's "Abrir TV" link. Without TV_KEY configured, checks are skipped
 * (local development).
 */
export function tvKey(): string | null {
  const k = process.env.TV_KEY?.trim();
  return k && k.length >= 8 ? k : null;
}

export function requireTvKey(given: unknown) {
  const expected = tvKey();
  if (!expected) return;
  const g = typeof given === "string" ? given : "";
  if (g.length !== expected.length || !timingSafeEqual(Buffer.from(g), Buffer.from(expected))) {
    throw new HttpError(403, "Solo la pantalla del local puede hacer esto");
  }
}
