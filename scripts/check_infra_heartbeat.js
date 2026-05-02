const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function checkDB() {
    try {
        const config = JSON.parse(fs.readFileSync('D:/projetos/ecossistema-atomico-pc/config.local.json', 'utf8'));
        
        console.log('Checking Mirror DB (163)...');
        const mirrorPool = new Pool({
            host: config.databases.mirror.host,
            port: config.databases.mirror.port,
            database: config.databases.mirror.database,
            user: config.databases.mirror.user,
            password: config.databases.mirror.password,
            connectionTimeoutMillis: 2000
        });
        const res1 = await mirrorPool.query('SELECT 1');
        console.log('Mirror DB: ?? OK');
        await mirrorPool.end();

        console.log('Checking Ecosystem DB (163)...');
        const ecoPool = new Pool({
            host: config.databases.ecosystem.host,
            port: config.databases.ecosystem.port,
            database: config.databases.ecosystem.database,
            user: config.databases.ecosystem.user,
            password: config.databases.ecosystem.password,
            connectionTimeoutMillis: 2000
        });
        const res2 = await ecoPool.query('SELECT 1');
        console.log('Ecosystem DB: ?? OK');
        await ecoPool.end();

    } catch (e) {
        console.error('DB Check failed:', e.message);
    } finally {
        process.exit();
    }
}
checkDB();
