import { validateEventWindow } from "../lib/slots";
import { generatePublicToken } from "../lib/tokens";

export type CreateEventInput = {
  title: string;
  timezone: string;
  startIso: string;
  endIso: string;
  granularityMinutes: number;
};

export type EventRecord = {
  id: number;
  publicToken: string;
  title: string;
  timezone: string;
  startIso: string;
  endIso: string;
  granularityMinutes: number;
  slotCount: number;
};

export async function createEvent(db: D1Database, input: CreateEventInput): Promise<EventRecord> {
  const { slotCount } = validateEventWindow(input);
  const publicToken = generatePublicToken();

  const result = await db
    .prepare(
      [
        "INSERT INTO events (public_token, title, timezone, start_iso, end_iso, granularity_minutes, slot_count)",
        "VALUES (?, ?, ?, ?, ?, ?, ?)"
      ].join(" ")
    )
    .bind(
      publicToken,
      input.title,
      input.timezone,
      input.startIso,
      input.endIso,
      input.granularityMinutes,
      slotCount
    )
    .run();

  return {
    id: Number(result.meta.last_row_id),
    publicToken,
    title: input.title,
    timezone: input.timezone,
    startIso: input.startIso,
    endIso: input.endIso,
    granularityMinutes: input.granularityMinutes,
    slotCount
  };
}

export async function getEventByToken(db: D1Database, token: string): Promise<EventRecord | null> {
  const row = await db
    .prepare(
      [
        "SELECT id, public_token, title, timezone, start_iso, end_iso, granularity_minutes, slot_count",
        "FROM events WHERE public_token = ?"
      ].join(" ")
    )
    .bind(token)
    .first<{
      id: number;
      public_token: string;
      title: string;
      timezone: string;
      start_iso: string;
      end_iso: string;
      granularity_minutes: number;
      slot_count: number;
    }>();

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    publicToken: row.public_token,
    title: row.title,
    timezone: row.timezone,
    startIso: row.start_iso,
    endIso: row.end_iso,
    granularityMinutes: row.granularity_minutes,
    slotCount: row.slot_count
  };
}
