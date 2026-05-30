type EventRow = {
  id: number;
  public_token: string;
  title: string;
  timezone: string;
  start_iso: string;
  end_iso: string;
  granularity_minutes: number;
  slot_count: number;
};

type ParticipantRow = {
  id: string;
  event_id: number;
  has_synced: number;
};

type AvailabilityRow = {
  event_id: number;
  participant_id: string;
  slot_index: number;
};

type SlotCountRow = {
  event_id: number;
  slot_index: number;
  count: number;
};

type Runner = {
  run: () => Promise<D1Result>;
  first: <T = unknown>() => Promise<T | null>;
  all: <T = unknown>() => Promise<D1Result<T>>;
};

class FakeStatement {
  private readonly sql: string;
  private boundArgs: unknown[] = [];
  private readonly db: FakeD1Database;

  constructor(db: FakeD1Database, sql: string) {
    this.db = db;
    this.sql = sql.replace(/\s+/g, " ").trim();
  }

  bind(...args: unknown[]): D1PreparedStatement {
    this.boundArgs = args;
    return this as unknown as D1PreparedStatement;
  }

  async run(): Promise<D1Result> {
    return this.runner().run();
  }

  async first<T = unknown>(): Promise<T | null> {
    return this.runner().first<T>();
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    return this.runner().all<T>();
  }

  private runner(): Runner {
    return this.db.execute(this.sql, this.boundArgs);
  }
}

export class FakeD1Database {
  private eventAutoId = 1;
  private readonly events: EventRow[] = [];
  private readonly participants: ParticipantRow[] = [];
  private readonly availability: AvailabilityRow[] = [];
  private readonly slotCounts: SlotCountRow[] = [];

  prepare(sql: string): D1PreparedStatement {
    return new FakeStatement(this, sql) as unknown as D1PreparedStatement;
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const results: D1Result<T>[] = [];
    for (const statement of statements as unknown as FakeStatement[]) {
      const result = await statement.run();
      results.push(result as D1Result<T>);
    }
    return results;
  }

  getParticipantsByEvent(eventId: number): ParticipantRow[] {
    return this.participants.filter((participant) => participant.event_id === eventId);
  }

  execute(sql: string, args: unknown[]): Runner {
    if (
      sql ===
      "INSERT INTO events (public_token, title, timezone, start_iso, end_iso, granularity_minutes, slot_count) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ) {
      return {
        run: async () => {
          const row: EventRow = {
            id: this.eventAutoId,
            public_token: String(args[0]),
            title: String(args[1]),
            timezone: String(args[2]),
            start_iso: String(args[3]),
            end_iso: String(args[4]),
            granularity_minutes: Number(args[5]),
            slot_count: Number(args[6])
          };
          this.events.push(row);
          this.eventAutoId += 1;
          return { success: true, meta: { last_row_id: row.id } } as D1Result;
        },
        first: async <T>() => null as T | null,
        all: async <T>() => ({ success: true, results: [] as T[] }) as D1Result<T>
      };
    }

    if (
      sql ===
      "SELECT id, public_token, title, timezone, start_iso, end_iso, granularity_minutes, slot_count FROM events WHERE public_token = ?"
    ) {
      return {
        run: async () => ({ success: true }) as D1Result,
        first: async <T>() => {
          const row = this.events.find((event) => event.public_token === String(args[0]));
          return (row ?? null) as T | null;
        },
        all: async <T>() => ({ success: true, results: [] as T[] }) as D1Result<T>
      };
    }

    if (sql === "INSERT INTO participants (id, event_id, has_synced) VALUES (?, ?, 0)") {
      return {
        run: async () => {
          const exists = this.participants.some((participant) => participant.id === String(args[0]));
          if (!exists) {
            this.participants.push({
              id: String(args[0]),
              event_id: Number(args[1]),
              has_synced: 0
            });
          }
          return { success: true } as D1Result;
        },
        first: async <T>() => null as T | null,
        all: async <T>() => ({ success: true, results: [] as T[] }) as D1Result<T>
      };
    }

    if (sql === "SELECT id, event_id FROM participants WHERE id = ?") {
      return {
        run: async () => ({ success: true }) as D1Result,
        first: async <T>() => {
          const row = this.participants.find((participant) => participant.id === String(args[0]));
          if (!row) {
            return null;
          }
          return { id: row.id, event_id: row.event_id } as T;
        },
        all: async <T>() => ({ success: true, results: [] as T[] }) as D1Result<T>
      };
    }

    if (sql === "SELECT COUNT(*) AS count FROM participants WHERE event_id = ? AND has_synced = 1") {
      return {
        run: async () => ({ success: true }) as D1Result,
        first: async <T>() => {
          const count = this.participants.filter(
            (participant) => participant.event_id === Number(args[0]) && participant.has_synced === 1
          ).length;
          return { count } as T;
        },
        all: async <T>() => ({ success: true, results: [] as T[] }) as D1Result<T>
      };
    }

    if (
      sql ===
      "SELECT slot_index, count FROM slot_counts WHERE event_id = ? AND count > 0 ORDER BY slot_index ASC"
    ) {
      return {
        run: async () => ({ success: true }) as D1Result,
        first: async <T>() => null as T | null,
        all: async <T>() => {
          const rows = this.slotCounts
            .filter((row) => row.event_id === Number(args[0]) && row.count > 0)
            .sort((a, b) => a.slot_index - b.slot_index);
          return { success: true, results: rows as unknown as T[] } as D1Result<T>;
        }
      };
    }

    if (
      sql ===
      "SELECT slot_index FROM availability WHERE event_id = ? AND participant_id = ? ORDER BY slot_index ASC"
    ) {
      return {
        run: async () => ({ success: true }) as D1Result,
        first: async <T>() => null as T | null,
        all: async <T>() => {
          const rows = this.availability
            .filter(
              (row) =>
                row.event_id === Number(args[0]) && row.participant_id === String(args[1])
            )
            .sort((a, b) => a.slot_index - b.slot_index)
            .map((row) => ({ slot_index: row.slot_index }));
          return { success: true, results: rows as unknown as T[] } as D1Result<T>;
        }
      };
    }

    if (
      sql ===
      "INSERT OR IGNORE INTO availability (event_id, participant_id, slot_index) VALUES (?, ?, ?)"
    ) {
      return {
        run: async () => {
          const key = {
            event_id: Number(args[0]),
            participant_id: String(args[1]),
            slot_index: Number(args[2])
          };
          const exists = this.availability.some(
            (row) =>
              row.event_id === key.event_id &&
              row.participant_id === key.participant_id &&
              row.slot_index === key.slot_index
          );
          if (!exists) {
            this.availability.push(key);
          }
          return { success: true } as D1Result;
        },
        first: async <T>() => null as T | null,
        all: async <T>() => ({ success: true, results: [] as T[] }) as D1Result<T>
      };
    }

    if (
      sql ===
      "INSERT INTO slot_counts (event_id, slot_index, count) VALUES (?, ?, 1) ON CONFLICT(event_id, slot_index) DO UPDATE SET count = count + 1"
    ) {
      return {
        run: async () => {
          const eventId = Number(args[0]);
          const slotIndex = Number(args[1]);
          const existing = this.slotCounts.find(
            (row) => row.event_id === eventId && row.slot_index === slotIndex
          );
          if (existing) {
            existing.count += 1;
          } else {
            this.slotCounts.push({ event_id: eventId, slot_index: slotIndex, count: 1 });
          }
          return { success: true } as D1Result;
        },
        first: async <T>() => null as T | null,
        all: async <T>() => ({ success: true, results: [] as T[] }) as D1Result<T>
      };
    }

    if (sql === "DELETE FROM availability WHERE event_id = ? AND participant_id = ? AND slot_index = ?") {
      return {
        run: async () => {
          const eventId = Number(args[0]);
          const participantId = String(args[1]);
          const slotIndex = Number(args[2]);
          const index = this.availability.findIndex(
            (row) =>
              row.event_id === eventId &&
              row.participant_id === participantId &&
              row.slot_index === slotIndex
          );
          if (index >= 0) {
            this.availability.splice(index, 1);
          }
          return { success: true } as D1Result;
        },
        first: async <T>() => null as T | null,
        all: async <T>() => ({ success: true, results: [] as T[] }) as D1Result<T>
      };
    }

    if (
      sql ===
      "UPDATE slot_counts SET count = CASE WHEN count > 0 THEN count - 1 ELSE 0 END WHERE event_id = ? AND slot_index = ?"
    ) {
      return {
        run: async () => {
          const eventId = Number(args[0]);
          const slotIndex = Number(args[1]);
          const existing = this.slotCounts.find(
            (row) => row.event_id === eventId && row.slot_index === slotIndex
          );
          if (existing) {
            existing.count = Math.max(0, existing.count - 1);
          }
          return { success: true } as D1Result;
        },
        first: async <T>() => null as T | null,
        all: async <T>() => ({ success: true, results: [] as T[] }) as D1Result<T>
      };
    }

    if (sql === "DELETE FROM slot_counts WHERE event_id = ? AND slot_index = ? AND count <= 0") {
      return {
        run: async () => {
          const eventId = Number(args[0]);
          const slotIndex = Number(args[1]);
          const index = this.slotCounts.findIndex(
            (row) => row.event_id === eventId && row.slot_index === slotIndex && row.count <= 0
          );
          if (index >= 0) {
            this.slotCounts.splice(index, 1);
          }
          return { success: true } as D1Result;
        },
        first: async <T>() => null as T | null,
        all: async <T>() => ({ success: true, results: [] as T[] }) as D1Result<T>
      };
    }

    if (
      sql ===
      "UPDATE participants SET has_synced = CASE WHEN EXISTS ( SELECT 1 FROM availability WHERE event_id = ? AND participant_id = ? LIMIT 1 ) THEN 1 ELSE 0 END WHERE event_id = ? AND id = ?"
    ) {
      return {
        run: async () => {
          const eventId = Number(args[0]);
          const participantId = String(args[1]);
          const participant = this.participants.find(
            (row) => row.event_id === Number(args[2]) && row.id === String(args[3])
          );
          if (participant) {
            const hasAny = this.availability.some(
              (row) => row.event_id === eventId && row.participant_id === participantId
            );
            participant.has_synced = hasAny ? 1 : 0;
          }
          return { success: true } as D1Result;
        },
        first: async <T>() => null as T | null,
        all: async <T>() => ({ success: true, results: [] as T[] }) as D1Result<T>
      };
    }

    throw new Error(`Unsupported SQL in FakeD1Database: ${sql}`);
  }
}
