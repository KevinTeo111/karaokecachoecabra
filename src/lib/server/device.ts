import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { HttpError } from "./http";

const COOKIE = "cec_device";
const MAX_AGE = 60 * 60 * 24 * 30;

function secret() {
  const s = process.env.DEVICE_TOKEN_SECRET;
  if (!s || s.length < 16) throw new Error("DEVICE_TOKEN_SECRET must be set (16+ chars)");
  return s;
}

function sign(id: string) {
  return createHmac("sha256", secret()).update(id).digest("hex");
}

/** Device id from a valid signed cookie, or null. Never trusts the body. */
export function deviceFromCookie(req: NextRequest): string | null {
  const raw = req.cookies.get(COOKIE)?.value;
  if (!raw) return null;
  const [id, sig] = raw.split(".");
  if (!id || !sig) return null;
  const expected = sign(id);
  if (expected.length !== sig.length) return null;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig)) ? id : null;
}

export function requireDevice(req: NextRequest): string {
  const id = deviceFromCookie(req);
  if (!id) throw new HttpError(401, "Dispositivo no registrado");
  return id;
}

/** Existing device id, or a fresh one that the caller must persist and set as cookie. */
export function resolveDevice(req: NextRequest): { id: string; isNew: boolean } {
  const existing = deviceFromCookie(req);
  return existing ? { id: existing, isNew: false } : { id: randomUUID(), isNew: true };
}

export function setDeviceCookie(res: NextResponse, id: string) {
  res.cookies.set(COOKIE, `${id}.${sign(id)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}
