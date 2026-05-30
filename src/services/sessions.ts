import { getSignedCookie, setSignedCookie } from "hono/cookie";
import type { Context } from "hono";
import { generateParticipantId } from "../lib/tokens";
import type { Env } from "../app";

const SESSION_COOKIE = "v2m_session";

type ParticipantRow = {
  id: string;
  event_id: number;
};

const baseCookieOptions = {
  httpOnly: true,
  sameSite: "Lax" as const,
  path: "/"
};

function isSecureRequest(c: Context<Env>): boolean {
  return c.req.url.startsWith("https://");
}

async function setSessionCookie(c: Context<Env>, participantId: string): Promise<void> {
  await setSignedCookie(c, SESSION_COOKIE, participantId, c.env.SESSION_SECRET, {
    ...baseCookieOptions,
    secure: isSecureRequest(c)
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
  participantId: string
): Promise<void> {
  await setSessionCookie(c, participantId);
}

export async function ensureEventSession(
  c: Context<Env>,
  eventId: number,
  options: { allowCreate: boolean }
): Promise<{ ok: true; participantId: string } | { ok: false; reason: "missing" | "invalid" | "cross_event" }> {
  const cookieParticipantId = await getSignedCookie(c, c.env.SESSION_SECRET, SESSION_COOKIE);

  if (!cookieParticipantId) {
    if (!options.allowCreate) {
      return { ok: false, reason: "missing" };
    }

    const participantId = await createParticipant(c.env.DB, eventId);
    await setSessionCookie(c, participantId);
    return { ok: true, participantId };
  }

  const participant = await getParticipantById(c.env.DB, cookieParticipantId);
  if (!participant) {
    if (!options.allowCreate) {
      return { ok: false, reason: "invalid" };
    }

    const participantId = await createParticipant(c.env.DB, eventId);
    await setSessionCookie(c, participantId);
    return { ok: true, participantId };
  }

  if (participant.event_id !== eventId) {
    if (!options.allowCreate) {
      return { ok: false, reason: "cross_event" };
    }

    const participantId = await createParticipant(c.env.DB, eventId);
    await setSessionCookie(c, participantId);
    return { ok: true, participantId };
  }

  return { ok: true, participantId: participant.id };
}
