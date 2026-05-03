
const cwd = process.cwd();
if (!cwd.toLowerCase().includes("-pc")) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error("This script MUST be executed from D:\projetos\ecossistema-atomico-pc");
    process.exit(1);
}


const { Pool } = require('pg');
const fs = require('fs');
async function test() {
    try {
        const config = JSON.parse(fs.readFileSync('config.local.json', 'utf8'));
        const pool = new Pool({
            host: config.databases.ecosystem.host,
            port: config.databases.ecosystem.port,
            database: config.databases.ecosystem.database,
            user: config.databases.ecosystem.user,
            password: config.databases.ecosystem.password,
            connectionTimeoutMillis: 5000
        });
        
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'migrations'");
        console.table(res.rows);

        const data = await pool.query('SELECT * FROM migrations');
        console.table(data.rows);

        await pool.end();
    } catch (e) {
        console.error('Test failed:', e.message);
    } finally {
        process.exit();
    }
}
test();
