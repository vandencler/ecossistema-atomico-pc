const { ecoPool } = require('../src/main/db');
async function check() {
  const res = await ecoPool.query("SELECT criado_em, COUNT(*) FROM acoes_pendentes WHERE tipo_acao = 'CORRECAO_CADASTRO' GROUP BY criado_em ORDER BY criado_em DESC");
  console.table(res.rows);
  process.exit(0);
}
check();
