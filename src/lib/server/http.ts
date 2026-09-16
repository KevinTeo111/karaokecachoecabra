import { NextResponse } from "next/server";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

/** Runs a handler and converts thrown errors into `{ error }` responses. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, { status: e.status });
    // Postgres exceptions raised by our functions arrive as PostgrestError with a message.
    const message = (e as { message?: string })?.message ?? "Error inesperado";
    const status = /no encontrad|inválid|cerr|activa|disponible|mismo|mesa|votaste|alguien|cambió|reemplazar/i.test(message)
      ? 409
      : 500;
    if (status === 500) console.error(e);
    return json({ error: status === 500 ? "Error inesperado" : message }, { status });
  }
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "JSON inválido");
  }
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new HttpError(400, message);
}

export const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
