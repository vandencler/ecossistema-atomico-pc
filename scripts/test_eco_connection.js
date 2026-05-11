const { Pool } = require('pg');
const fs = require('fs');
async function test() {
    try {
        const config = JSON.parse(fs.readFileSync('D:/projetos/ecossistema-atomico-pc/config.local.json', 'utf8'));
        const pool = new Pool({
            host: config.databases.ecosystem.host,
            port: config.databases.ecosystem.port,
            database: config.databases.ecosystem.database,
            user: config.databases.ecosystem.user,
            password: config.databases.ecosystem.password,
            connectionTimeoutMillis: 5000
        });
        const res = await pool.query('SELECT NOW()');
        console.log('Ecosystem connection successful:', res.rows[0].now);
        await pool.end();
    } catch (e) {
        console.error('Ecosystem connection failed:', e.message);
    } finally {
        process.exit();
    }
}
test();
