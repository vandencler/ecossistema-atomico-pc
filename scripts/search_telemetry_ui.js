const { ecoPool } = require('../src/main/db');

async function run() {
  try {
    const res = await ecoPool.query(`
      SELECT * FROM telemetry_events 
      WHERE payload::text ILIKE '%sidebar%' 
         OR payload::text ILIKE '%menu%' 
         OR event_name ILIKE '%sidebar%'
         OR event_name ILIKE '%ui%'
      ORDER BY occurred_at DESC
      LIMIT 100
    `);
    console.log('Telemetry Events:', res.rows);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

run();
