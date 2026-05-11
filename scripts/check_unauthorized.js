const { ecoPool } = require("../src/main/db");
async function run() {
    try {
        console.log("Checking for unauthorized test patterns...");
        const res = await ecoPool.query(`
            SELECT * FROM telemetry_events 
            WHERE (payload->>'user' LIKE 'rep_%' OR payload->>'idpessoa' LIKE 'rep_%')
              AND occurred_at > NOW() - INTERVAL '24 hours'
            LIMIT 10
        `);
        console.table(res.rows.map(r => ({ id: r.id, event: r.event_name, user: r.user_id, payload: JSON.stringify(r.payload) })));
    } catch (e) {
        console.error("Check failed:", e.message);
    } finally {
        process.exit();
    }
}
run();
