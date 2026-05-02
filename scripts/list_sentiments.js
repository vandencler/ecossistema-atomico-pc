const { ecoPool } = require('../src/main/db');

async function run() {
  const res = await ecoPool.query('SELECT idpessoa, sentiment_label, sentiment_score FROM ml_client_sentiment');
  console.table(res.rows);
  process.exit(0);
}

run();
