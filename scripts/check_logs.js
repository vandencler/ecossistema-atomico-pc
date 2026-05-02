
const cwd = process.cwd();
if (!cwd.toLowerCase().includes("-pc")) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error("This script MUST be executed from D:\projetos\ecossistema-atomico-pc");
    process.exit(1);
}

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
