const { ecoPool } = require('../src/main/db');
async function check() {
  const res = await ecoPool.query("SELECT status, COUNT(*) FROM nps_scores GROUP BY status");
  console.table(res.rows);
  process.exit(0);
}
check();
