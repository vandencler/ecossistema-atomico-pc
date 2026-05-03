const { Pool } = require('pg');
const fs = require('fs');
async function run() {
    const config = JSON.parse(fs.readFileSync('config.local.json', 'utf8'));
    const pool = new Pool({
        host: config.databases.ecosystem.host,
        port: config.databases.ecosystem.port,
        database: config.databases.ecosystem.database,
        user: config.databases.ecosystem.user,
        password: config.databases.ecosystem.password
    });
    
    console.log('--- config_sistema indexes ---');
    const resConfig = await pool.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'config_sistema'");
    console.table(resConfig.rows);

    console.log('--- telemetry_events indexes ---');
    const resTelemetry = await pool.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'telemetry_events'");
    console.table(resTelemetry.rows);

    await pool.end();
}
run().catch(console.error);
