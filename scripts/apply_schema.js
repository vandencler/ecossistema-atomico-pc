const fs = require('fs');
const path = require('path');
const { ecoPool } = require('../src/main/db');

async function run() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, '../src/main/db/schema.sql'), 'utf8');
    await ecoPool.query(schema);
    console.log('Schema applied.');
    const res = await ecoPool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tables:', res.rows.map(r => r.table_name));
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

run();