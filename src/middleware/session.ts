import type { Context } from "hono";
import type { Env } from "../app";
import { ensureEventSession } from "../services/sessions";

export async function requireEventSession(
  c: Context<Env>,
  eventId: number,
  options: { allowCreate: boolean },
): Promise<
  | { ok: true; participantId: string }
  | { ok: false; status: 401 | 503; message: string }
> {
  const result = await ensureEventSession(c, eventId, options);
  if (result.ok) {
    return result;
  }

  if (result.reason === "misconfigured") {
    return {
      ok: false,
      status: 503,
      message: "Server misconfigured: SESSION_SECRET is not set",
    };
  }

  return {
    ok: false,
    status: 401,
    message:
      result.reason === "cross_event"
        ? "Session does not belong to this event"
        : "Missing or invalid session",
  };
}
