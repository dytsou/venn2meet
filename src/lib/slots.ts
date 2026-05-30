export const MAX_EVENT_DAYS = 14;
export const MIN_GRANULARITY_MINUTES = 15;
export const MAX_EVENT_SLOTS = 672;

type ValidateEventWindowInput = {
  startIso: string;
  endIso: string;
  granularityMinutes: number;
};

function parseIso(iso: string): Date {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid ISO timestamp");
  }
  return parsed;
}

export function computeSlotCount(
  startIso: string,
  endIso: string,
  granularityMinutes: number
): number {
  const start = parseIso(startIso);
  const end = parseIso(endIso);
  const millis = end.getTime() - start.getTime();

  if (millis <= 0) {
    throw new Error("End time must be after start time");
  }

  const granularityMillis = granularityMinutes * 60 * 1000;
  if (millis % granularityMillis !== 0) {
    throw new Error("Range must align to granularity");
  }

  return millis / granularityMillis;
}

export function validateEventWindow(input: ValidateEventWindowInput): { slotCount: number } {
  const { startIso, endIso, granularityMinutes } = input;

  if (granularityMinutes < MIN_GRANULARITY_MINUTES) {
    throw new Error(`Granularity must be at least ${MIN_GRANULARITY_MINUTES} minutes`);
  }

  if (granularityMinutes % MIN_GRANULARITY_MINUTES !== 0) {
    throw new Error(`Granularity must be a multiple of ${MIN_GRANULARITY_MINUTES}`);
  }

  const start = parseIso(startIso);
  const end = parseIso(endIso);
  const days = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);

  if (days > MAX_EVENT_DAYS) {
    throw new Error(`Date range cannot exceed ${MAX_EVENT_DAYS} days`);
  }

  const slotCount = computeSlotCount(startIso, endIso, granularityMinutes);
  if (slotCount > MAX_EVENT_SLOTS) {
    throw new Error(`Slot count cannot exceed ${MAX_EVENT_SLOTS}`);
  }

  return { slotCount };
}

export function assertSlotIndexInRange(slotIndex: number, slotCount: number): void {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= slotCount) {
    throw new Error("Slot index out of range");
  }
}
