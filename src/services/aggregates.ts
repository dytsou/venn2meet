import { assertSlotIndexInRange } from "../lib/slots";

export type ParticipantAggregateSnapshot = {
  participantId: string;
  hasSynced: boolean;
  slots: number[];
};

export type AggregatePayload = {
  n: number;
  slots: Array<{ i: number; count: number }>;
  mine: number[];
};

type BuildAggregatePayloadInput = {
  participants: ParticipantAggregateSnapshot[];
  viewerParticipantId: string;
  slotCount: number;
};

export function buildAggregatePayload(input: BuildAggregatePayloadInput): AggregatePayload {
  const { participants, viewerParticipantId, slotCount } = input;
  const counts = new Map<number, number>();
  let n = 0;
  let mine: number[] = [];

  for (const participant of participants) {
    if (participant.participantId === viewerParticipantId) {
      mine = [...participant.slots].sort((a, b) => a - b);
    }

    if (!participant.hasSynced) {
      continue;
    }

    n += 1;
    for (const slot of participant.slots) {
      assertSlotIndexInRange(slot, slotCount);
      counts.set(slot, (counts.get(slot) ?? 0) + 1);
    }
  }

  const slots = Array.from(counts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([i, count]) => ({ i, count }));

  return {
    n,
    slots,
    mine
  };
}

export async function getAggregatePayloadFromDb(args: {
  db: D1Database;
  eventId: number;
  participantId: string;
  slotCount: number;
}): Promise<AggregatePayload> {
  const { db, eventId, participantId } = args;

  const nRow = await db
    .prepare("SELECT COUNT(*) AS count FROM participants WHERE event_id = ? AND has_synced = 1")
    .bind(eventId)
    .first<{ count: number | string }>();

  const slotRows = await db
    .prepare("SELECT slot_index, count FROM slot_counts WHERE event_id = ? AND count > 0 ORDER BY slot_index ASC")
    .bind(eventId)
    .all<{ slot_index: number; count: number }>();

  const mineRows = await db
    .prepare(
      "SELECT slot_index FROM availability WHERE event_id = ? AND participant_id = ? ORDER BY slot_index ASC"
    )
    .bind(eventId, participantId)
    .all<{ slot_index: number }>();

  return {
    n: Number(nRow?.count ?? 0),
    slots: (slotRows.results ?? []).map((row) => ({
      i: row.slot_index,
      count: row.count
    })),
    mine: (mineRows.results ?? []).map((row) => row.slot_index)
  };
}
