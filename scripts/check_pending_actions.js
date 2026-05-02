
const cwd = process.cwd();
if (!cwd.toLowerCase().includes("-pc")) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error("This script MUST be executed from D:\projetos\ecossistema-atomico-pc");
    process.exit(1);
}

const { ecoPool } = require('../src/main/db');

async function check() {
  try {
    const res = await ecoPool.query(`
      SELECT status, COUNT(*) as count 
      FROM acoes_pendentes 
      GROUP BY status
    `);
    console.log('Status of pending actions:', res.rows);

    const pendingDetails = await ecoPool.query(`
      SELECT id, idpessoa, campo, status, criado_em, aprovado_em
      FROM acoes_pendentes
      WHERE status NOT IN ('CONCLUIDO', 'REJEITADO', 'CANCELADO')
      ORDER BY criado_em ASC
    `);
    console.log('Active Pending Items:', pendingDetails.rows);

    const lat = await ecoPool.query(`
      SELECT id, idpessoa, campo, aprovado_em, executado_em,
             EXTRACT(EPOCH FROM (executado_em - aprovado_em)) as latency
      FROM acoes_pendentes
      WHERE status = 'CONCLUIDO'
      ORDER BY executado_em DESC
      LIMIT 5
    `);
    console.log('Recent latencies:', lat.rows);

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

check();
