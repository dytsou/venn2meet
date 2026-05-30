import { describe, expect, it } from "vitest";
import {
  buildAggregatePayload,
  type ParticipantAggregateSnapshot
} from "../src/services/aggregates";
import { validateAvailabilityDiff } from "../src/services/availability";

describe("aggregates", () => {
  it("builds aggregate payload with n, slots, and mine only", () => {
    const participants: ParticipantAggregateSnapshot[] = [
      { participantId: "p1", hasSynced: true, slots: [0, 1] },
      { participantId: "p2", hasSynced: true, slots: [1] },
      { participantId: "p3", hasSynced: false, slots: [] }
    ];

    const payload = buildAggregatePayload({
      participants,
      viewerParticipantId: "p1",
      slotCount: 4
    });

    expect(payload).toEqual({
      n: 2,
      slots: [
        { i: 0, count: 1 },
        { i: 1, count: 2 }
      ],
      mine: [0, 1]
    });
    expect(Object.keys(payload).sort()).toEqual(["mine", "n", "slots"]);
  });

  it("returns empty slots for n=0", () => {
    const payload = buildAggregatePayload({
      participants: [],
      viewerParticipantId: "viewer",
      slotCount: 8
    });

    expect(payload).toEqual({
      n: 0,
      slots: [],
      mine: []
    });
  });

  it("rejects out-of-range slot indexes in availability diff", () => {
    expect(() => {
      validateAvailabilityDiff({
        select: [0, 3],
        deselect: [],
        slotCount: 3
      });
    }).toThrow("Slot index out of range");
  });
});
