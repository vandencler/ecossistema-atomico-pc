
const cwd = process.cwd();
if (!cwd.toLowerCase().includes('-pc')) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error('This script MUST be executed from D:\projetos\ecossistema-atomico-pc');
    process.exit(1);
}

const { Pool } = require('pg');
const fs = require('fs');
async function check() {
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
        const res = await pool.query('SHOW max_connections');
        console.log('max_connections:', res.rows[0].max_connections);
        await pool.end();
    } catch (e) {
        console.error(e.message);
    } finally {
        process.exit();
    }
}
check();
