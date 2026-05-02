const { ecoPool } = require('../src/main/db');

async function run() {
  try {
    const res = await ecoPool.query(`
      SELECT tipo, detalhe, criado_em 
      FROM log_eventos 
      WHERE tipo LIKE '%_ERROR%' 
      ORDER BY criado_em DESC 
      LIMIT 10
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
