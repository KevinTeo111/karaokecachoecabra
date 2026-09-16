import { SUPABASE_URL } from "@/lib/supabase/server";

export const sessionTopic = (sessionId: string) => `session:${sessionId}`;

/**
 * Publishes a broadcast message through Supabase Realtime's REST endpoint.
 * Clients subscribed to the session channel react without the server holding
 * a websocket. Fire-and-forget: a lost message is covered by client polling.
 */
export async function broadcast(sessionId: string, event: "changed" | "tick", payload: Record<string, unknown> = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  try {
    await fetch(`${SUPABASE_URL()}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ topic: sessionTopic(sessionId), event, payload, private: false }] }),
    });
  } catch (e) {
    console.error("broadcast failed", e);
  }
}
