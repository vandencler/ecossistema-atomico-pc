const { ecoPool } = require('../db');
const { getLocalDb } = require('../localDb');
const crypto = require('crypto');

const SESSION_ID = crypto.randomUUID();

/**
 * Telemetry Service: Tracks user interactions and performance metrics.
 * Designed with offline resilience via SQLite buffering.
 */

async function trackEvent(eventName, userId, payload = {}) {
  const occurredAt = new Date().toISOString();
  console.log(`[TELEMETRY] ${eventName} | User: ${userId}`);

  // 1. Always buffer to local SQLite first for resilience
  try {
    const db = getLocalDb();
    db.prepare(`
      INSERT INTO telemetry_buffer (event_name, user_id, payload, occurred_at)
      VALUES (?, ?, ?, ?)
    `).run(eventName, userId, JSON.stringify(payload), occurredAt);
  } catch (e) {
    console.error('[TELEMETRY] Failed to buffer locally:', e.message);
  }

  // 2. Proactively try to flush if online
  setImmediate(() => flushTelemetry());
}

async function flushTelemetry() {
  const db = getLocalDb();
  const pending = db.prepare('SELECT * FROM telemetry_buffer WHERE synced = 0 LIMIT 50').all();

  if (pending.length === 0) return;

  for (const event of pending) {
    try {
      await ecoPool.query(`
        INSERT INTO telemetry_events (event_name, user_id, payload, occurred_at, session_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [event.event_name, event.user_id, JSON.parse(event.payload), event.occurred_at, SESSION_ID]);

      db.prepare('DELETE FROM telemetry_buffer WHERE id = ?').run(event.id);
    } catch (e) {
      // If PostgreSQL is unreachable, we stop flushing and leave events in SQLite
      console.warn('[TELEMETRY] Sync failed, will retry later:', e.message);
      break;
    }
  }
}

module.exports = {
  trackEvent,
  flushTelemetry,
  SESSION_ID
};
