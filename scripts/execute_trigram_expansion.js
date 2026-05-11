const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function executeSql() {
    let pool;
    try {
        const configPath = path.resolve('config.local.json');
        const sqlPath = path.resolve('docs/EAV_DBA_TRIGRAM_EXPANSION_EAV-194.sql');

        if (!fs.existsSync(configPath)) {
            throw new Error(`Config file not found at ${configPath}`);
        }
        if (!fs.existsSync(sqlPath)) {
            throw new Error(`SQL file not found at ${sqlPath}`);
        }

        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Connecting to Mirror DB (192.168.2.163)...');
        pool = new Pool({
            host: config.databases.mirror.host,
            port: config.databases.mirror.port,
            database: config.databases.mirror.database,
            user: config.databases.mirror.user,
            password: config.databases.mirror.password,
            connectionTimeoutMillis: 10000
        });

        console.log('Checking table ownership...');
        const ownerRes = await pool.query("SELECT schemaname, tablename, tableowner FROM pg_tables WHERE tablename = 'pessoas' AND schemaname = 'wshop'");
        if (ownerRes.rows.length === 0) {
            throw new Error('Table wshop.pessoas not found.');
        }
        const owner = ownerRes.rows[0].tableowner;
        const currentUser = config.databases.mirror.user;
        console.log(`Table wshop.pessoas is owned by: ${owner}`);
        console.log(`Current user: ${currentUser}`);

        if (owner !== currentUser) {
            console.error(`[BLOCKER] Permission Denied. Table wshop.pessoas is owned by ${owner}, but we are connected as ${currentUser}.`);
            console.error('An escalation to the Board for ownership transfer or superuser execution is required.');
            process.exit(1);
        }

        console.log('Executing Trigram Expansion SQL...');
        // Split SQL into statements to execute them one by one if needed, 
        // but pg.query can handle multiple statements if they don't require specific orchestration.
        // However, CREATE INDEX can be slow, so we'll set a longer timeout.
        const start = Date.now();
        await pool.query(sql);
        const duration = (Date.now() - start) / 1000;

        console.log(`SQL executed successfully in ${duration.toFixed(2)}s.`);

        console.log('Verifying indexes...');
        const verificationQuery = "SELECT indexname FROM pg_indexes WHERE tablename = 'pessoas' AND indexname LIKE '%trgm%'";
        const res = await pool.query(verificationQuery);
        console.log('Current Trigram Indexes on wshop.pessoas:');
        res.rows.forEach(row => console.log(` - ${row.indexname}`));

    } catch (e) {
        console.error('Execution failed:', e.message);
        if (e.stack) console.error(e.stack);
        process.exit(1);
    } finally {
        if (pool) await pool.end();
        process.exit(0);
    }
}

executeSql();
