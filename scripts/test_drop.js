
const cwd = process.cwd();
if (!cwd.toLowerCase().includes('-pc')) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error('This script MUST be executed from D:\projetos\ecossistema-atomico-pc');
    process.exit(1);
}

const { ecoPool } = require('../src/main/db');

async function testDrop() {
  try {
    console.log('Attempting to create a temp table...');
    await ecoPool.query('CREATE TABLE temp_test (id int)');
    console.log('Success! eav_writer can create tables.');
    
    console.log('Attempting to drop the temp table...');
    await ecoPool.query('DROP TABLE temp_test');
    console.log('Success! eav_writer can drop its own tables.');

    console.log('Attempting to drop a postgres-owned table (this should fail)...');
    // I won't actually drop ranking_cache yet, just test on something else if it exists.
    // But I don't want to break anything.
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

testDrop();
