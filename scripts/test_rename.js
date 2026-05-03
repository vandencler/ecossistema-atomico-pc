
const cwd = process.cwd();
if (!cwd.toLowerCase().includes('-pc')) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error('This script MUST be executed from D:\projetos\ecossistema-atomico-pc');
    process.exit(1);
}

const { ecoPool } = require('../src/main/db');

async function testRename() {
  try {
    console.log('Attempting to create temp table...');
    await ecoPool.query('CREATE TABLE temp_rename (id int)');
    
    console.log('Attempting to rename it...');
    await ecoPool.query('ALTER TABLE temp_rename RENAME TO temp_rename_v2');
    console.log('Success! eav_writer can rename its own tables.');

    console.log('Attempting to rename ranking_cache (postgres-owned)...');
    await ecoPool.query('ALTER TABLE ranking_cache RENAME TO ranking_cache_old');
    console.log('Wait, if this works, I can swap them!');
  } catch (e) {
    console.error('Failed:', e.message);
  } finally {
    process.exit(0);
  }
}

testRename();
