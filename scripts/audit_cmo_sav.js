const { ecoPool } = require('../src/main/db');
async function auditPending() {
  const res = await ecoPool.query(`
    SELECT tipo_acao, motivo, COUNT(*) 
    FROM acoes_pendentes 
    WHERE status = 'PENDENTE' 
    GROUP BY tipo_acao, motivo 
    ORDER BY count DESC
  `);
  console.log('Pending Actions Breakdown:');
  console.table(res.rows);
  process.exit(0);
}
auditPending();
