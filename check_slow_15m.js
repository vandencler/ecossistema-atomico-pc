const { ecoPool } = require('./src/main/db.js');

async function checkSlow() {
  try {
    const slowRes = await ecoPool.query(`
      SELECT COUNT(*) as count
      FROM telemetry_events
      WHERE event_name = 'SLOW_QUERY'
        AND occurred_at > NOW() - INTERVAL '15 minutes'
    `);
    console.log(`Slow Queries (15m): ${slowRes.rows[0].count}`);
  } catch(e) {
    console.error(e.message);
  } finally {
    process.exit(0);
  }
}
checkSlow();