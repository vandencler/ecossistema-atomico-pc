const { ecoPool } = require('../src/main/db');

async function checkLogs() {
  try {
    const res = await ecoPool.query(`
      SELECT tipo, idpessoa, detalhe, criado_em 
      FROM log_eventos 
      WHERE tipo IN ('OMNI_WA_FAIL', 'SEARCH_ERROR') 
      ORDER BY criado_em DESC 
      LIMIT 20
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

checkLogs();
