const { pool } = require('../src/main/db');
async function run() {
    try {
        const res = await pool.query('SHOW max_connections');
        console.log('Current max_connections:', res.rows[0].max_connections);
    } catch (e) {
        console.error('Check failed:', e.message);
    } finally {
        process.exit();
    }
}
run();
