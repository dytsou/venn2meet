import { assertSlotIndexInRange } from "../lib/slots";

export const DB_PARAMETER_LIMIT = 100;
const SELECT_PARAMS_PER_SLOT = 9;
const DESELECT_PARAMS_PER_SLOT = 9;
const AVAILABILITY_SELECT_CHUNK_SIZE = Math.floor(DB_PARAMETER_LIMIT / SELECT_PARAMS_PER_SLOT);
const AVAILABILITY_DESELECT_CHUNK_SIZE = Math.floor(DB_PARAMETER_LIMIT / DESELECT_PARAMS_PER_SLOT);

export type AvailabilityDiffInput = {
  select: number[];
  deselect: number[];
  slotCount: number;
};

export function validateAvailabilityDiff(input: AvailabilityDiffInput): {
  select: number[];
  deselect: number[];
} {
  const { select, deselect, slotCount } = input;
  const seen = new Set<number>();

  const normalize = (slots: number[]): number[] => {
    const clean: number[] = [];
    for (const slot of slots) {
      assertSlotIndexInRange(slot, slotCount);
      if (seen.has(slot)) {
        continue;
      }
      seen.add(slot);
      clean.push(slot);
    }
    return clean;
  };

  const normalizedSelect = normalize(select);
  const normalizedDeselect = normalize(deselect);

  return {
    select: normalizedSelect,
    deselect: normalizedDeselect
  };
}

function chunkArray(values: number[], size: number): number[][] {
  const chunks: number[][] = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

export async function applyAvailabilityDiff(args: {
  db: D1Database;
  eventId: number;
  participantId: string;
  slotCount: number;
  select: number[];
  deselect: number[];
}): Promise<void> {
  const { db, eventId, participantId, slotCount } = args;
  const { select, deselect } = validateAvailabilityDiff({
    select: args.select,
    deselect: args.deselect,
    slotCount
  });

  for (const selectChunk of chunkArray(select, AVAILABILITY_SELECT_CHUNK_SIZE)) {
    const statements: D1PreparedStatement[] = [];
    for (const slot of selectChunk) {
      statements.push(
        db
          .prepare(
            [
              "INSERT OR IGNORE INTO availability (event_id, participant_id, slot_index)",
              "VALUES (?, ?, ?)"
            ].join(" ")
          )
          .bind(eventId, participantId, slot),
        db
          .prepare(
            [
              "INSERT INTO slot_counts (event_id, slot_index, count)",
              "VALUES (?, ?, (SELECT COUNT(*) FROM availability WHERE event_id = ? AND slot_index = ?))",
              "ON CONFLICT(event_id, slot_index) DO UPDATE SET count = excluded.count"
            ].join(" ")
          )
          .bind(eventId, slot, eventId, slot),
        db
          .prepare("DELETE FROM slot_counts WHERE event_id = ? AND slot_index = ? AND count <= 0")
          .bind(eventId, slot)
      );
    }
    if (statements.length > 0) {
      await db.batch(statements);
    }
  }

  for (const deselectChunk of chunkArray(deselect, AVAILABILITY_DESELECT_CHUNK_SIZE)) {
    const statements: D1PreparedStatement[] = [];
    for (const slot of deselectChunk) {
      statements.push(
        db
          .prepare("DELETE FROM availability WHERE event_id = ? AND participant_id = ? AND slot_index = ?")
          .bind(eventId, participantId, slot),
        db
          .prepare(
            [
              "INSERT INTO slot_counts (event_id, slot_index, count)",
              "VALUES (?, ?, (SELECT COUNT(*) FROM availability WHERE event_id = ? AND slot_index = ?))",
              "ON CONFLICT(event_id, slot_index) DO UPDATE SET count = excluded.count"
            ].join(" ")
          )
          .bind(eventId, slot, eventId, slot),
        db
          .prepare("DELETE FROM slot_counts WHERE event_id = ? AND slot_index = ? AND count <= 0")
          .bind(eventId, slot)
      );
    }
    if (statements.length > 0) {
      await db.batch(statements);
    }
  }

  await db
    .prepare(
      [
        "UPDATE participants",
        "SET has_synced = CASE",
        "WHEN EXISTS (",
        "  SELECT 1 FROM availability WHERE event_id = ? AND participant_id = ? LIMIT 1",
        ") THEN 1 ELSE 0 END",
        "WHERE event_id = ? AND id = ?"
      ].join(" ")
    )
    .bind(eventId, participantId, eventId, participantId)
    .run();
}
