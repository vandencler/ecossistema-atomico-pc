const { ecoPool } = require('../src/main/db');

async function run() {
  try {
    const res = await ecoPool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tables in public schema:', res.rows.map(r => r.table_name));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

run();
