const { ecoPool } = require('../src/main/db');

async function run() {
    try {
        console.log("--- Version Distribution (Last 24h) ---");
        const res = await ecoPool.query(`
            SELECT 
                payload->>'version' as version, 
                COUNT(*) as count 
            FROM telemetry_events 
            WHERE occurred_at > NOW() - INTERVAL '24 hours' 
            GROUP BY 1 
            ORDER BY count DESC
        `);
        console.table(res.rows);

        console.log("\n--- Unique Users per Version (Last 4h) ---");
        const res2 = await ecoPool.query(`
            SELECT 
                payload->>'version' as version, 
                COUNT(DISTINCT user_id) as unique_users
            FROM telemetry_events 
            WHERE occurred_at > NOW() - INTERVAL '4 hours' 
              AND payload->>'version' IS NOT NULL
            GROUP BY 1 
            ORDER BY unique_users DESC
        `);
        console.table(res2.rows);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

run();
