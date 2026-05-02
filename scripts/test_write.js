const { ecoPool } = require('../src/main/db');
async function run() {
  try {
    const res = await ecoPool.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'ml_product_affinity'");
    console.table(res.rows);
  } finally { process.exit(0); }
}
run();
