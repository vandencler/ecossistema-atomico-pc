const cwd = process.cwd();
if (!cwd.toLowerCase().includes('-pc')) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error('This script MUST be executed from D:\projetos\ecossistema-atomico-pc');
    process.exit(1);
}


const { ecoPool } = require('../src/main/db');

async function run() {
  try {
    const res = await ecoPool.query(`
      SELECT event_name, user_id, count(*) 
      FROM telemetry_events 
      GROUP BY 1, 2 
      ORDER BY count DESC 
      LIMIT 20
    `);
    console.table(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
