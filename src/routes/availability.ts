import type { Context } from "hono";
import type { Env } from "../app";
import { enforceRateLimit, limitFor } from "../middleware/rate-limit";
import { requireEventSession } from "../middleware/session";
import { getEventByToken } from "../services/events";
import { applyAvailabilityDiff } from "../services/availability";

type AvailabilityBody = {
  select?: number[];
  deselect?: number[];
};

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => Number.isInteger(item));
}

export async function createAvailabilityRoute(c: Context<Env>) {
  const token = c.req.param("token");
  const event = await getEventByToken(c.env.DB, token);
  if (!event) {
    return c.json({ error: "Event not found" }, 404);
  }

  const session = await requireEventSession(c, event.id, { allowCreate: false });
  if (!session.ok) {
    return c.json({ error: session.message }, session.status);
  }

  if (
    !enforceRateLimit(c, {
      bucket: `write:${event.id}:${session.participantId}`,
      limit: limitFor(c, "WRITE")
    })
  ) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  const body = (await c.req.json().catch(() => null)) as AvailabilityBody | null;
  if (!body) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const select = body.select ?? [];
  const deselect = body.deselect ?? [];
  if (!isNumberArray(select) || !isNumberArray(deselect)) {
    return c.json({ error: "select and deselect must be integer arrays" }, 400);
  }

  try {
    await applyAvailabilityDiff({
      db: c.env.DB,
      eventId: event.id,
      participantId: session.participantId,
      slotCount: event.slotCount,
      select,
      deselect
    });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }

  return c.json({ ok: true });
}
