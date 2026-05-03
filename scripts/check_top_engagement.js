const cwd = process.cwd();
if (!cwd.toLowerCase().includes('-pc')) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error('This script MUST be executed from D:\projetos\ecossistema-atomico-pc');
    process.exit(1);
}


const { ecoPool } = require('../src/main/db');

async function run() {
  try {
    const res = await ecoPool.query(`
      SELECT 
        p.idpessoa, 
        p.nmcurto, 
        ce.score_engajamento,
        r.abc,
        c.risk_score
      FROM clientes_enriquecidos ce 
      JOIN client_cache p ON ce.idpessoa = p.idpessoa 
      JOIN ml_client_profiles cp ON ce.idpessoa = cp.idpessoa 
      JOIN ranking_cache r ON ce.idpessoa = r.idpessoa
      JOIN ml_churn_risk c ON ce.idpessoa = c.idpessoa
      WHERE cp.cidade = 'Sorocaba' 
      ORDER BY ce.score_engajamento DESC 
      LIMIT 10
    `);
    console.table(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
