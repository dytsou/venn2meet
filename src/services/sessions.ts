import { getSignedCookie, setSignedCookie } from "hono/cookie";
import type { Context } from "hono";
import { generateParticipantId } from "../lib/tokens";
import type { Env } from "../app";

const SESSION_COOKIE_PREFIX = "v2m_session_";

type ParticipantRow = {
  id: string;
  event_id: number;
};

const baseCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "Lax" as const,
  path: "/"
};

function sessionCookieNameForEvent(eventId: number): string {
  return `${SESSION_COOKIE_PREFIX}${eventId}`;
}

async function setEventSessionCookie(
  c: Context<Env>,
  eventId: number,
  participantId: string
): Promise<void> {
  await setSignedCookie(c, sessionCookieNameForEvent(eventId), participantId, c.env.SESSION_SECRET, {
    ...baseCookieOptions
  });
}

async function getParticipantById(db: D1Database, participantId: string): Promise<ParticipantRow | null> {
  const row = await db
    .prepare("SELECT id, event_id FROM participants WHERE id = ?")
    .bind(participantId)
    .first<ParticipantRow>();
  return row ?? null;
}

export async function createParticipant(db: D1Database, eventId: number): Promise<string> {
  const participantId = generateParticipantId();
  await db
    .prepare("INSERT INTO participants (id, event_id, has_synced) VALUES (?, ?, 0)")
    .bind(participantId, eventId)
    .run();
  return participantId;
}

export async function issueSessionForParticipant(
  c: Context<Env>,
  eventId: number,
  participantId: string
): Promise<void> {
  await setEventSessionCookie(c, eventId, participantId);
}

async function createAndIssueSession(c: Context<Env>, eventId: number): Promise<string> {
  const participantId = await createParticipant(c.env.DB, eventId);
  await setEventSessionCookie(c, eventId, participantId);
  return participantId;
}

export async function ensureEventSession(
  c: Context<Env>,
  eventId: number,
  options: { allowCreate: boolean }
): Promise<{ ok: true; participantId: string } | { ok: false; reason: "missing" | "invalid" | "cross_event" }> {
  const cookieParticipantId = await getSignedCookie(
    c,
    c.env.SESSION_SECRET,
    sessionCookieNameForEvent(eventId)
  );

  if (!cookieParticipantId) {
    if (!options.allowCreate) {
      return { ok: false, reason: "missing" };
    }

    const participantId = await createAndIssueSession(c, eventId);
    return { ok: true, participantId };
  }

  const participant = await getParticipantById(c.env.DB, cookieParticipantId);
  if (!participant) {
    if (!options.allowCreate) {
      return { ok: false, reason: "invalid" };
    }

    const participantId = await createAndIssueSession(c, eventId);
    return { ok: true, participantId };
  }

  if (participant.event_id !== eventId) {
    if (!options.allowCreate) {
      return { ok: false, reason: "cross_event" };
    }

    const participantId = await createAndIssueSession(c, eventId);
    return { ok: true, participantId };
  }

  return { ok: true, participantId: participant.id };
}
