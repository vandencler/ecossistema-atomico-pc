
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
            host: config.databases.mirror.host,
            port: config.databases.mirror.port,
            database: config.databases.mirror.database,
            user: config.databases.mirror.user,
            password: config.databases.mirror.password,
            connectionTimeoutMillis: 5000
        });
        
        console.log(`Checking indexes for wshop.pessoas in ${config.databases.mirror.database}...`);
        const res = await pool.query(`
            SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE schemaname = 'wshop' AND tablename = 'pessoas'
        `);
        console.table(res.rows);

        await pool.end();
    } catch (e) {
        console.error('Test failed:', e.message);
    } finally {
        process.exit();
    }
}
test();
