const { ecoPool } = require('../src/main/db');

async function run() {
  const res = await ecoPool.query('SELECT COUNT(*) FROM omnichannel_mensagens');
  console.log('Total messages:', res.rows[0].count);
  process.exit(0);
}

run();
