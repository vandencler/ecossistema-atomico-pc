-- Migration 002: Telemetry Buffer
CREATE TABLE IF NOT EXISTS telemetry_buffer (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name TEXT NOT NULL,
  user_id TEXT,
  payload TEXT, -- JSON string
  occurred_at TEXT NOT NULL,
  synced INTEGER DEFAULT 0
);
