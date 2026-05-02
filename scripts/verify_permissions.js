
const cwd = process.cwd();
if (!cwd.toLowerCase().includes('-pc')) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    process.exit(1);
}
const { Pool } = require('pg');
const fs = require('fs');
async function test() {
    try {
        const config = JSON.parse(fs.readFileSync('D:/projetos/ecossistema-atomico-pc/config.local.json', 'utf8'));
        const pool = new Pool({
            host: config.databases.mirror.host,
            port: config.databases.mirror.port,
            database: config.databases.mirror.database,
            user: config.databases.mirror.user,
            password: config.databases.mirror.password,
            connectionTimeoutMillis: 2000
        });
        const tables = ['wshop.pessoas', 'wshop.crediar', 'wshop.documen', 'wshop.docitem', 'wshop.produto', 'wshop.tabelaprecos', 'wshop.movcaix', 'wshop.ranking_calculadoloja'];
        console.log(`Checking permissions for ${config.databases.mirror.user}...`);
        for (const table of tables) {
            try {
                await pool.query(`SELECT 1 FROM ${table} LIMIT 1`);
                console.log(`[OK] ${table}`);
            } catch (e) {
                console.log(`[FAIL] ${table}: ${e.message}`);
            }
        }
        await pool.end();
    } catch (e) {
        console.error('Test failed:', e.message);
    } finally {
        process.exit();
    }
}
test();
