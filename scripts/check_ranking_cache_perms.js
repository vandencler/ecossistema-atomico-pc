
const cwd = process.cwd();
if (!cwd.toLowerCase().includes('-pc')) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error('This script MUST be executed from D:\projetos\ecossistema-atomico-pc');
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
        
        console.log(`Checking ranking_cache in ${config.databases.ecosystem.database}...`);
        
        // Check ownership
        const ownerRes = await pool.query(`
            SELECT tableowner 
            FROM pg_tables 
            WHERE tablename = 'ranking_cache'
        `);
        if (ownerRes.rows.length > 0) {
            console.log(`Table owner: ${ownerRes.rows[0].tableowner}`);
        } else {
            console.log('Table ranking_cache not found.');
        }

        // Try to create index
        console.log('Attempting to create index idx_ranking_cache_freshness...');
        try {
            await pool.query('CREATE INDEX IF NOT EXISTS idx_ranking_cache_freshness ON ranking_cache(calculado_em DESC)');
            console.log('[SUCCESS] Index created.');
        } catch (e) {
            console.log(`[FAIL] Index creation failed: ${e.message}`);
        }

        await pool.end();
    } catch (e) {
        console.error('Test failed:', e.message);
    } finally {
        process.exit();
    }
}
test();
