const { ecoPool } = require("../src/main/db");
async function run() {
    try {
        console.log("Analyzing slow queries from telemetry...");
        const res = await ecoPool.query(`
            SELECT 
                payload->>'sql' as sql_partial,
                count(*) as count,
                AVG((payload->>'duration')::numeric) as avg_duration
            FROM telemetry_events
            WHERE event_name = 'SLOW_QUERY'
              AND occurred_at > NOW() - INTERVAL '1 hour'
            GROUP BY 1
            ORDER BY count DESC
            LIMIT 5
        `);
        console.table(res.rows);
    } catch (e) {
        console.error("Analysis failed:", e.message);
    } finally {
        process.exit();
    }
}
run();
