const { ecoPool } = require('../src/main/db');
async function check() {
  const res = await ecoPool.query("SELECT * FROM ml_client_profiles LIMIT 10");
  console.table(res.rows);
  process.exit(0);
}
check();
