CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_token TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  timezone TEXT NOT NULL,
  start_iso TEXT NOT NULL,
  end_iso TEXT NOT NULL,
  granularity_minutes INTEGER NOT NULL,
  slot_count INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  event_id INTEGER NOT NULL,
  has_synced INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_participants_event ON participants(event_id);
CREATE INDEX IF NOT EXISTS idx_participants_event_synced ON participants(event_id, has_synced);

CREATE TABLE IF NOT EXISTS availability (
  event_id INTEGER NOT NULL,
  participant_id TEXT NOT NULL,
  slot_index INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id, participant_id, slot_index),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_availability_event_slot ON availability(event_id, slot_index);
CREATE INDEX IF NOT EXISTS idx_availability_participant ON availability(participant_id);

CREATE TABLE IF NOT EXISTS slot_counts (
  event_id INTEGER NOT NULL,
  slot_index INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id, slot_index),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_slot_counts_event ON slot_counts(event_id);
