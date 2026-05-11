const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function executeStrategy() {
    const sqlPath = path.join(__dirname, '../docs/EAV_DBA_TRIGRAM_EXPANSION_EAV-194.sql');
    const configPath = path.join(__dirname, '../config.local.json');
    
    console.log(`[DBA] Reading strategy from ${sqlPath}...`);
    
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log(`[DBA] Connecting to ${config.databases.mirror.host}:${config.databases.mirror.port}...`);
        
        const pool = new Pool({
            host: 'localhost',
            port: config.databases.mirror.port,
            database: config.databases.mirror.database,
            user: config.databases.mirror.user,
            password: config.databases.mirror.password,
            connectionTimeoutMillis: 1000,
            idleTimeoutMillis: 1000,
            ssl: false
        });
        
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        console.log(`[DBA] Found ${statements.length} statements to execute.`);

        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i];
            console.log(`[${new Date().toISOString()}] [DBA] Executing statement ${i + 1}/${statements.length}...`);
            const start = Date.now();
            try {
                await pool.query(stmt);
                console.log(`[DBA] Done in ${Date.now() - start}ms.`);
            } catch (err) {
                console.error(`[DBA] Error executing statement ${i + 1}:`, err.message);
                if (err.message.includes('permission denied')) {
                    console.error('[DBA] FATAL: Permission denied on Mirror DB.');
                    process.exit(1);
                }
            }
        }

        console.log('[DBA] Trigram Expansion Strategy execution loop complete.');
        
        // Verification
        console.log('[DBA] Verifying indexes...');
        const res = await pool.query("SELECT indexname FROM pg_indexes WHERE tablename = 'pessoas' AND indexname LIKE '%trgm%'");
        console.log(`[DBA] Found ${res.rowCount} trigram indexes on 'pessoas':`);
        res.rows.forEach(row => console.log(` - ${row.indexname}`));

        await pool.end();
    } catch (err) {
        console.error('[DBA] Critical error:', err.stack);
    } finally {
        process.exit();
    }
}

executeStrategy();
