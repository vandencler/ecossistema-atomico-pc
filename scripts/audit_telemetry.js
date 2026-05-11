const { ecoPool } = require("D:/projetos/ecossistema-atomico-pc/src/main/db");

async function run() {
    console.log("=== EAV Telemetry Performance Audit ===");
    try {
        // 1. Identifying Top 10 Slowest Queries in the last 24h
        console.log("\n--- Top 10 Slowest Queries (Last 24h) ---");
        const slowQueries = await ecoPool.query(`
            SELECT 
                payload->>'sql' as sql_preview,
                payload->>'duration' as duration_ms,
                user_id,
                occurred_at
            FROM telemetry_events
            WHERE event_name = 'SLOW_QUERY'
              AND occurred_at > NOW() - INTERVAL '24 hours'
            ORDER BY (payload->>'duration')::numeric DESC
            LIMIT 10
        `);
        console.table(slowQueries.rows.map(r => ({
            ...r,
            sql_preview: (r.sql_preview || "").substring(0, 80) + "..."
        })));

        // 2. Identifying UI Bottlenecks (Events with high duration)
        console.log("\n--- UI / IPC Performance Bottlenecks (>200ms) ---");
        const uiBottlenecks = await ecoPool.query(`
            SELECT 
                event_name,
                payload->>'channel' as channel,
                payload->>'duration_ms' as duration_ms,
                user_id,
                occurred_at
            FROM telemetry_events
            WHERE (event_name LIKE 'ipc_%' OR event_name LIKE 'ui_%')
              AND (payload->>'duration_ms')::numeric > 200
              AND occurred_at > NOW() - INTERVAL '24 hours'
            ORDER BY (payload->>'duration_ms')::numeric DESC
            LIMIT 10
        `);
        console.table(uiBottlenecks.rows);

        // 3. Summary of Event Distribution
        console.log("\n--- Event Distribution (Last 24h) ---");
        const distribution = await ecoPool.query(`
            SELECT event_name, COUNT(*) as count
            FROM telemetry_events
            WHERE occurred_at > NOW() - INTERVAL '24 hours'
            GROUP BY event_name
            ORDER BY count DESC
        `);
        console.table(distribution.rows);

    } catch (e) {
        console.error("Audit failed:", e.message);
    } finally {
        process.exit(0);
    }
}

run();
