const { ecoPool } = require('../src/main/db');

async function checkConfig() {
  try {
    const res = await ecoPool.query(`
      SELECT * FROM config_sistema 
      WHERE chave LIKE 'nps%'
    `);
    console.table(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

checkConfig();
