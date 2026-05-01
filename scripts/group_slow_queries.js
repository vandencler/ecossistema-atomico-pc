const { ecoPool } = require('../src/main/db');

async function groupSlow() {
  try {
    const res = await ecoPool.query(`
      SELECT 
        payload->>'pool' as pool,
        SUBSTRING(payload->>'sql', 1, 100) as query_start,
        COUNT(*) as count,
        AVG((payload->>'duration')::int) as avg_duration,
        MAX((payload->>'duration')::int) as max_duration
      FROM telemetry_events
      WHERE event_name = 'SLOW_QUERY'
        AND occurred_at > NOW() - INTERVAL '1 hour'
      GROUP BY 1, 2
      ORDER BY count DESC
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch(e) {
    console.error(e.message);
  } finally {
    process.exit(0);
  }
}
groupSlow();