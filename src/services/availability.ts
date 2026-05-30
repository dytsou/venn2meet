import { assertSlotIndexInRange } from "../lib/slots";

export const DB_PARAMETER_LIMIT = 100;
export const AVAILABILITY_DIFF_CHUNK_SIZE = 50;

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

  const statements: D1PreparedStatement[] = [];

  for (const slot of select) {
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
            "VALUES (?, ?, 1)",
            "ON CONFLICT(event_id, slot_index) DO UPDATE SET count = count + 1"
          ].join(" ")
        )
        .bind(eventId, slot)
    );
  }

  for (const slot of deselect) {
    statements.push(
      db
        .prepare("DELETE FROM availability WHERE event_id = ? AND participant_id = ? AND slot_index = ?")
        .bind(eventId, participantId, slot),
      db
        .prepare(
          [
            "UPDATE slot_counts SET count = CASE WHEN count > 0 THEN count - 1 ELSE 0 END",
            "WHERE event_id = ? AND slot_index = ?"
          ].join(" ")
        )
        .bind(eventId, slot),
      db.prepare("DELETE FROM slot_counts WHERE event_id = ? AND slot_index = ? AND count <= 0").bind(eventId, slot)
    );
  }

  for (const chunk of chunkStatements(statements)) {
    if (chunk.length > 0) {
      await db.batch(chunk);
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

function chunkStatements(statements: D1PreparedStatement[]): D1PreparedStatement[][] {
  const maxStatementsPerBatch = Math.floor(DB_PARAMETER_LIMIT / 2);
  const chunkSize = Math.min(AVAILABILITY_DIFF_CHUNK_SIZE, maxStatementsPerBatch);
  return chunkArray(statements.map((_, index) => index), chunkSize).map((indexChunk) =>
    indexChunk.map((index) => statements[index])
  );
}
