const { ecoPool } = require('../src/main/db');
async function run() {
    try {
        console.log('Analyzing last 10 slow queries...');
        const res = await ecoPool.query(`
            SELECT 
                payload->>'sql' as sql,
                (payload->>'duration')::numeric as duration,
                occurred_at
            FROM telemetry_events
            WHERE event_name = 'SLOW_QUERY'
              AND occurred_at > NOW() - INTERVAL '15 minutes'
            ORDER BY occurred_at DESC
            LIMIT 10
        `);
        console.table(res.rows);
    } catch (e) {
        console.error('Check failed:', e.message);
    } finally {
        process.exit();
    }
}
run();
