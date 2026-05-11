const { ecoPool } = require('../src/main/db');

async function auditIds() {
  try {
    const res = await ecoPool.query(`
      SELECT user_id, COUNT(*), MIN(occurred_at) as first_seen
      FROM telemetry_events 
      WHERE occurred_at > '2026-05-10' 
      GROUP BY user_id 
      ORDER BY 2 DESC
    `);
    console.table(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

auditIds();
