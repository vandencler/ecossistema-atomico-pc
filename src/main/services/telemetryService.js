const { ecoPool } = require('../db');
const { getLocalDb } = require('../localDb');
const crypto = require('crypto');

const SESSION_ID = crypto.randomUUID();

/**
 * Telemetry Service: Tracks user interactions and performance metrics.
 * Designed with offline resilience via SQLite buffering.
 */

let isFlushing = false;

async function trackEvent(eventName, userId, payload = {}) {
  const occurredAt = new Date().toISOString();
  console.log(`[TELEMETRY] ${eventName} | User: ${userId}`);

  // 1. Always buffer to local SQLite first for resilience
  try {
    const db = getLocalDb();
    if (db) {
      db.prepare(`
        INSERT INTO telemetry_buffer (event_name, user_id, payload, occurred_at)
        VALUES (?, ?, ?, ?)
      `).run(eventName, userId, JSON.stringify(payload), occurredAt);
    }
  } catch (e) {
    if (e.message.includes('not initialized')) {
      // Quietly ignore in CLI/Test contexts where localDb isn't required
      return;
    }
    console.error('[TELEMETRY] Failed to buffer locally:', e.message);
  }

  // 2. Proactively try to flush if not already flushing
  if (!isFlushing) {
    setImmediate(() => flushTelemetry());
  }
}

async function flushTelemetry() {
  if (isFlushing) return;
  isFlushing = true;

  try {
    const db = getLocalDb();
    const pending = db.prepare('SELECT * FROM telemetry_buffer LIMIT 100').all();

    if (pending.length === 0) return;

    // Use a multi-row insert for efficiency
    const values = pending.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(', ');
    const flatParams = [];
    pending.forEach(e => {
      flatParams.push(e.event_name, e.user_id, JSON.parse(e.payload), e.occurred_at, SESSION_ID);
    });

    try {
      await ecoPool.query(`
        INSERT INTO telemetry_events (event_name, user_id, payload, occurred_at, session_id)
        VALUES ${values}
      `, flatParams);

      const ids = pending.map(e => e.id);
      db.prepare(`DELETE FROM telemetry_buffer WHERE id IN (${ids.map(() => '?').join(',')})`).run(ids);
      
      // If we hit the limit, there's more to flush
      if (pending.length === 100) {
        setImmediate(() => flushTelemetry());
      }
    } catch (e) {
      console.warn('[TELEMETRY] Sync failed, will retry later:', e.message);
    }
  } finally {
    isFlushing = false;
  }
}

module.exports = {
  trackEvent,
  flushTelemetry,
  SESSION_ID
};
