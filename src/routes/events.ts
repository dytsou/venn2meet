import type { Context } from "hono";
import type { Env } from "../app";
import { enforceRateLimit, limitFor } from "../middleware/rate-limit";
import { createEvent } from "../services/events";
import { requireSessionSecret } from "../lib/config";
import {
  createParticipant,
  issueSessionForParticipant,
} from "../services/sessions";

type CreateEventBody = {
  title?: string;
  timezone?: string;
  startIso?: string;
  endIso?: string;
  granularityMinutes?: number;
};

function badRequest(c: Context<Env>, message: string) {
  return c.json({ error: message }, 400);
}

export async function createEventRoute(c: Context<Env>) {
  if (
    !enforceRateLimit(c, { bucket: "create", limit: limitFor(c, "CREATE") })
  ) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  const body = (await c.req.json().catch(() => null)) as CreateEventBody | null;
  if (!body) {
    return badRequest(c, "Invalid JSON body");
  }

  const title = body.title?.trim();
  const timezone = body.timezone?.trim();
  const startIso = body.startIso;
  const endIso = body.endIso;
  const granularityMinutes = body.granularityMinutes;

  if (
    !title ||
    !timezone ||
    !startIso ||
    !endIso ||
    !Number.isInteger(granularityMinutes)
  ) {
    return badRequest(c, "Missing required event fields");
  }

  const secretCheck = requireSessionSecret(c);
  if (secretCheck instanceof Response) {
    return secretCheck;
  }

  let event;
  try {
    event = await createEvent(c.env.DB, {
      title,
      timezone,
      startIso,
      endIso,
      granularityMinutes: Number(granularityMinutes),
    });
  } catch (error) {
    return badRequest(c, (error as Error).message);
  }

  const participantId = await createParticipant(c.env.DB, event.id);
  await issueSessionForParticipant(c, event.id, participantId);

  return c.json(
    {
      url: `/e/${event.publicToken}`,
      token: event.publicToken,
      slotCount: event.slotCount,
    },
    201,
  );
}
