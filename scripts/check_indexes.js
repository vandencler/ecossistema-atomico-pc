const { Pool } = require('pg');
const fs = require('fs');

async function checkIndexes() {
    const config = JSON.parse(fs.readFileSync('config.local.json', 'utf8'));
    const pool = new Pool({
        host: config.databases.mirror.host,
        port: config.databases.mirror.port,
        database: config.databases.mirror.database,
        user: config.databases.mirror.user,
        password: config.databases.mirror.password
    });

    try {
        const res = await pool.query("SELECT indexname FROM pg_indexes WHERE tablename = 'pessoas' AND indexname LIKE '%trgm%'");
        console.log('Current Trigram Indexes:');
        res.rows.forEach(r => console.log(r.indexname));
    } catch (e) {
        console.error(e.message);
    } finally {
        await pool.end();
    }
}
checkIndexes();
