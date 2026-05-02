
const cwd = process.cwd();
if (!cwd.toLowerCase().includes("-pc")) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    process.exit(1);
}
const { ecoPool } = require('../src/main/db');

async function run() {
  try {
    const res = await ecoPool.query(`
      SELECT COUNT(*) 
      FROM log_eventos 
      WHERE tipo = 'SEARCH_ERROR' 
      AND criado_em > now() - interval '1 hour'
    `);
    console.log('Errors in last hour:', res.rows[0].count);

    const res2 = await ecoPool.query(`
      SELECT COUNT(*) 
      FROM log_eventos 
      WHERE tipo = 'SEARCH_ERROR' 
      AND criado_em > now() - interval '24 hours'
    `);
    console.log('Errors in last 24 hours:', res2.rows[0].count);

    const res3 = await ecoPool.query(`
      SELECT detalhe, criado_em 
      FROM log_eventos 
      WHERE tipo = 'SEARCH_ERROR' 
      ORDER BY criado_em DESC 
      LIMIT 5
    `);
    console.log('Latest 5 errors:');
    res3.rows.forEach(r => console.log(`[${r.criado_em}] ${r.detalhe}`));

  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
