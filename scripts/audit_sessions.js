const { ecoPool } = require('../src/main/db');
async function check() {
  const res = await ecoPool.query("SELECT * FROM log_eventos ORDER BY criado_em DESC LIMIT 20");
  console.table(res.rows);
  process.exit(0);
}
check();
