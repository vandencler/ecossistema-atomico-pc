const { ecoPool } = require('../src/main/db');
async function run() {
    try {
        console.log('Identifying users running the wrong code...');
        const res = await ecoPool.query(`
            SELECT 
                user_id,
                count(*) as count,
                MAX(occurred_at) as last_seen
            FROM telemetry_events
            WHERE event_name = 'SLOW_QUERY'
              AND payload->>'sql' LIKE '%config_sistema%ANY%'
              AND occurred_at > NOW() - INTERVAL '1 hour'
            GROUP BY 1
            ORDER BY count DESC
        `);
        console.table(res.rows);
    } catch (e) {
        console.error('Analysis failed:', e.message);
    } finally {
        process.exit();
    }
}
run();
