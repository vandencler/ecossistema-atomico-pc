const { ecoPool } = require("../src/main/db");
async function run() {
    try {
        console.log("Checking for recent slow queries (last 15m)...");
        const res = await ecoPool.query(`
            SELECT count(*) 
            FROM telemetry_events 
            WHERE event_name = 'SLOW_QUERY' 
              AND occurred_at > NOW() - INTERVAL '15 minutes'
        `);
        console.log(`Slow queries: ${res.rows[0].count}`);
    } catch (e) {
        console.error("Check failed:", e.message);
    } finally {
        process.exit();
    }
}
run();
