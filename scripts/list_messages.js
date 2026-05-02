const { ecoPool } = require('../src/main/db');

async function run() {
  const res = await ecoPool.query('SELECT * FROM omnichannel_mensagens ORDER BY criado_em DESC');
  console.table(res.rows);
  process.exit(0);
}

run();
