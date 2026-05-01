const { ecoPool } = require('../src/main/db');

async function main() {
  try {
    const res = await ecoPool.query(`
      SELECT payload, occurred_at 
      FROM telemetry_events 
      WHERE event_name = 'SLOW_QUERY' 
      AND occurred_at > NOW() - INTERVAL '15 minutes'
      ORDER BY occurred_at DESC
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e.message);
  } finally {
    process.exit(0);
  }
}

main();