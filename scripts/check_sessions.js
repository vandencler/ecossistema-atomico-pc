const { ecoPool } = require('../src/main/db');

async function run() {
  try {
    const res = await ecoPool.query(`
      SELECT session_id, COUNT(*) as event_count
      FROM telemetry_events
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 10
    `);
    console.table(res.rows);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

run();
