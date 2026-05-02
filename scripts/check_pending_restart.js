
const cwd = process.cwd();
if (!cwd.toLowerCase().includes('-pc')) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error('This script MUST be executed from D:\projetos\ecossistema-atomico-pc');
    process.exit(1);
}

const { pool } = require('../src/main/db');
async function run() {
    try {
        const res = await pool.query("SELECT name, setting, pending_restart FROM pg_settings WHERE name = 'max_connections'");
        console.table(res.rows);
    } catch (e) {
        console.error('Check failed:', e.message);
    } finally {
        process.exit();
    }
}
run();
