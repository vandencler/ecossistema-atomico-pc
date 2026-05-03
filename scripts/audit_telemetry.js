
const cwd = process.cwd();
if (!cwd.toLowerCase().includes('-pc')) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    process.exit(1);
}
const { ecoPool } = require('../src/main/db');

async function run() {
    try {
        console.log('=== TELEMETRY ERROR AUDIT (Last 24h) ===');
        const res = await ecoPool.query(`
          SELECT tipo, count(*) as total, MAX(criado_em) as last_seen
          FROM log_eventos 
          WHERE (tipo LIKE '%ERROR%' OR tipo LIKE '%FAIL%') 
            AND criado_em > NOW() - INTERVAL '24 hours' 
          GROUP BY 1 
          ORDER BY total DESC
        `);
        console.table(res.rows);

        console.log('\n=== RECENT ERROR DETAILS ===');
        const detailRes = await ecoPool.query(`
          SELECT tipo, idpessoa, SUBSTRING(detalhe, 1, 150) as detail, criado_em 
          FROM log_eventos 
          WHERE (tipo LIKE '%ERROR%' OR tipo LIKE '%FAIL%') 
            AND criado_em > NOW() - INTERVAL '24 hours' 
          ORDER BY criado_em DESC 
          LIMIT 10
        `);
        console.table(detailRes.rows);

        console.log('\n=== SLOW QUERY AUDIT (Last 1h) ===');
        const slowRes = await ecoPool.query(`
          SELECT 
            payload->>'pool' as pool,
            payload->>'duration' as ms,
            SUBSTRING(payload->>'sql', 1, 100) as sql,
            occurred_at
          FROM telemetry_events 
          WHERE event_name = 'SLOW_QUERY' 
            AND occurred_at > NOW() - INTERVAL '1 hour' 
          ORDER BY (payload->>'duration')::integer DESC 
          LIMIT 10
        `);
        console.table(slowRes.rows);

    } catch (e) {
        console.error('Audit failed:', e.message);
    } finally {
        process.exit();
    }
}
run();
