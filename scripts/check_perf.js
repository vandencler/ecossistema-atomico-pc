const { pool } = require("../src/main/db");
async function run() {
    try {
        const res = await pool.query("SHOW max_connections");
        console.log("Max Connections:", res.rows[0].max_connections);
        
        const indices = await pool.query("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'wshop' AND tablename = 'docitem'");
        console.log("Indices on docitem:");
        console.table(indices.rows);
    } catch (e) {
        console.error(e.message);
    } finally {
        process.exit();
    }
}
run();
