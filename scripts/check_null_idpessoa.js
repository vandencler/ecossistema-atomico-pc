const { pool } = require('../src/main/db');
async function check() {
  const res = await pool.query("SELECT idpessoa, iddocumento FROM wshop.documen WHERE idpessoa IS NULL OR idpessoa = '' LIMIT 10");
  console.table(res.rows);
  process.exit(0);
}
check();
