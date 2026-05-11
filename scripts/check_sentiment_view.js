const { ecoPool } = require('../src/main/db');
async function check() {
  try {
    const res = await ecoPool.query("SELECT * FROM v_sentimento_feedback LIMIT 10");
    console.table(res.rows);
  } catch (e) {
    console.log('v_sentimento_feedback does not exist or error:', e.message);
  }
  process.exit(0);
}
check();
