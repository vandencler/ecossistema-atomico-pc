const { ecoPool } = require('../db');
const { getLocalDb } = require('../localDb');
const crypto = require('crypto');
const os = require('os');

const SESSION_ID = crypto.randomUUID();
let systemIdentity = `${os.userInfo().username}@${os.hostname()}` || 'unknown';

let isFlushing = false;

function setIdentity(identity) {
  if (identity && typeof identity === 'string') {
    systemIdentity = identity.trim();
    console.log(`[TELEMETRY] Identity set to: ${systemIdentity}`);
  }
}

function getIdentity() {
  return systemIdentity;
}

async function trackEvent(eventName, userId, payload = {}) {
  const occurredAt = new Date().toISOString();
  const targetUser = userId && userId !== 'auto' && userId !== 'sistema' ? userId : systemIdentity;

  console.log(`[TELEMETRY] ${eventName} | User: ${targetUser}`);

  try {
    const db = getLocalDb();
    if (db) {
      db.prepare(`
        INSERT INTO telemetry_buffer (event_name, user_id, payload, occurred_at)
        VALUES (?, ?, ?, ?)
      `).run(eventName, targetUser, JSON.stringify(payload), occurredAt);
    }
  } catch (e) {
    if (e.message.includes('not initialized')) return;
    console.error('[TELEMETRY] Failed to buffer locally:', e.message);
  }

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

    const values = pending.map((_, i) => `($${i * 5 + 1}::text, $${i * 5 + 2}::text, $${i * 5 + 3}::jsonb, $${i * 5 + 4}::timestamptz, $${i * 5 + 5}::uuid)`).join(', ');
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

      if (pending.length === 100) {
        // Add a small delay between batches to prevent DB saturation
        setTimeout(() => flushTelemetry(), 200);
      }
    } catch (e) {
      console.warn('[TELEMETRY] Sync failed, will retry later:', e.message);
    }
  } finally {
    isFlushing = false;
  }
}

async function recordFeedback(satisfaction, comment, deviceInfo = {}) {
  const userId = getIdentity();
  try {
    await ecoPool.query(`
      INSERT INTO app_feedback (user_id, satisfaction, comment, device_info)
      VALUES ($1, $2, $3, $4)
    `, [userId, satisfaction, comment, deviceInfo]);

    await trackEvent('user_feedback_submitted', userId, { satisfaction, comment });
    return { ok: true };
  } catch (e) {
    console.error('[TELEMETRY] Failed to record feedback:', e.message);
    throw e;
  }
}

module.exports = {
  trackEvent,
  flushTelemetry,
  setIdentity,
  getIdentity,
  recordFeedback,
  SESSION_ID
};
