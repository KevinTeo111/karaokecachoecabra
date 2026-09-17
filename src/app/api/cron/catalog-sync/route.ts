import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { handle, HttpError, json } from "@/lib/server/http";
import { runCatalogSync } from "@/lib/youtube/catalog";

export const maxDuration = 60;

/**
 * Nightly maintenance, triggered by the VPS crontab with the CRON_SECRET.
 * Syncs channel uploads, runs pending category queries, health-checks songs.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const secret = process.env.CRON_SECRET ?? "";
    const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (secret.length < 16 || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
      throw new HttpError(401, "No autorizado");
    }
    return json(await runCatalogSync(50_000));
  });
}
