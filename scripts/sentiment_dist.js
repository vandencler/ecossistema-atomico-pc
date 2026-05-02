const { ecoPool } = require('../src/main/db');

async function run() {
  const res = await ecoPool.query('SELECT sentiment_label, COUNT(*) FROM ml_client_sentiment GROUP BY 1');
  console.log('Sentiment distribution:', res.rows);
  process.exit(0);
}

run();
