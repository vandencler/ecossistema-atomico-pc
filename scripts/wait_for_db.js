const { pool } = require('../src/main/db');

async function waitForDb() {
  console.log('Waiting for database to come online...');
  for (let i = 0; i < 30; i++) {
    try {
      const res = await pool.query("SELECT name, setting, pending_restart FROM pg_settings WHERE name = 'max_connections'");
      console.log('Database is UP!');
      console.table(res.rows);
      process.exit(0);
    } catch (e) {
      console.log('Still waiting... ' + e.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.log('Timeout waiting for DB.');
  process.exit(1);
}
waitForDb();
