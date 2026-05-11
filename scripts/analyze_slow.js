const { ecoPool } = require("../src/main/db");
async function run() {
    try {
        console.log("Analyzing slow queries...");
        const res = await ecoPool.query(`
            SELECT 
                payload->>'sql' as sql_partial, 
                count(*) as count, 
                avg((payload->>'duration')::numeric) as avg_duration 
            FROM telemetry_events 
            WHERE event_name = 'SLOW_QUERY' 
              AND occurred_at > NOW() - INTERVAL '2 hours'
            GROUP BY 1
            ORDER BY count DESC
            LIMIT 10
        `);
        console.table(res.rows);
    } catch (e) {
        console.error("Analysis failed:", e.message);
    } finally {
        process.exit();
    }
}
run();
