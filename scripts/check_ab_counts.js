const { ecoPool } = require('../src/main/db');

async function run() {
  try {
    const res = await ecoPool.query(`
      SELECT payload->>'group' as ab_group, count(*) 
      FROM telemetry_events 
      WHERE event_name = 'intel_score_calculated' 
      GROUP BY 1
    `);
    console.table(res.rows);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

run();
