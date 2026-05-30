import { describe, expect, it } from "vitest";
import {
  MAX_EVENT_DAYS,
  MAX_EVENT_SLOTS,
  MIN_GRANULARITY_MINUTES,
  assertSlotIndexInRange,
  computeSlotCount,
  validateEventWindow
} from "../src/lib/slots";

describe("slots", () => {
  it("computes slot count from range and granularity", () => {
    const start = "2026-06-01T08:00:00.000Z";
    const end = "2026-06-01T10:00:00.000Z";

    expect(computeSlotCount(start, end, 30)).toBe(4);
  });

  it("rejects granularity below minimum", () => {
    expect(() => {
      validateEventWindow({
        startIso: "2026-06-01T08:00:00.000Z",
        endIso: "2026-06-01T10:00:00.000Z",
        granularityMinutes: MIN_GRANULARITY_MINUTES - 5
      });
    }).toThrow("Granularity must be at least");
  });

  it("rejects range beyond day cap", () => {
    expect(() => {
      validateEventWindow({
        startIso: "2026-06-01T00:00:00.000Z",
        endIso: "2026-06-16T00:00:00.000Z",
        granularityMinutes: 30
      });
    }).toThrow(`Date range cannot exceed ${MAX_EVENT_DAYS} days`);
  });

  it("rejects slot counts over cap", () => {
    const end = new Date(Date.UTC(2026, 5, 9, 0, 0, 0, 0)).toISOString();

    expect(() => {
      validateEventWindow({
        startIso: "2026-06-01T00:00:00.000Z",
        endIso: end,
        granularityMinutes: 15
      });
    }).toThrow(`Slot count cannot exceed ${MAX_EVENT_SLOTS}`);
  });

  it("rejects slot index out of range", () => {
    expect(() => assertSlotIndexInRange(10, 10)).toThrow("Slot index out of range");
  });
});
