import type { Context } from "hono";
import type { Env } from "../app";
import { enforceRateLimit, limitFor } from "../middleware/rate-limit";
import { requireEventSession } from "../middleware/session";
import { getEventByToken } from "../services/events";
import { getAggregatePayloadFromDb } from "../services/aggregates";

export async function createGridRoute(c: Context<Env>) {
  const token = c.req.param("token");
  const event = await getEventByToken(c.env.DB, token);
  if (!event) {
    return c.json({ error: "Event not found" }, 404);
  }

  if (!enforceRateLimit(c, { bucket: `join:${event.id}`, limit: limitFor(c, "JOIN") })) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  const session = await requireEventSession(c, event.id, { allowCreate: true });
  if (!session.ok) {
    return c.json({ error: session.message }, session.status);
  }

  const payload = await getAggregatePayloadFromDb({
    db: c.env.DB,
    eventId: event.id,
    participantId: session.participantId,
    slotCount: event.slotCount
  });

  return c.json(payload);
}
