const { pool } = require('../src/main/db');
async function check() {
  const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'wshop' AND table_name = 'crediar'");
  console.table(res.rows);
  process.exit(0);
}
check();
