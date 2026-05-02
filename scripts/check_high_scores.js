
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
      SELECT ce.idpessoa, ce.score_engajamento, r.abc, p.cidade, p.stcredbloqueado
      FROM clientes_enriquecidos ce
      LEFT JOIN ranking_cache r ON r.idpessoa = ce.idpessoa
      LEFT JOIN ml_client_profiles p ON p.idpessoa = ce.idpessoa
      WHERE ce.score_engajamento > 90
      LIMIT 10
    `);
    console.table(res.rows);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

run();
