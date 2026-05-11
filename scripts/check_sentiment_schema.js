const { ecoPool } = require('../src/main/db');
async function check() {
  const res = await ecoPool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ml_client_sentiment'");
  console.table(res.rows);
  process.exit(0);
}
check();
