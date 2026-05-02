const { ecoPool } = require('../src/main/db');

async function main() {
  try {
    await ecoPool.query('ALTER TABLE acoes_pendentes ADD COLUMN IF NOT EXISTS revisando_por VARCHAR(100)');
    console.log('Column revisando_por added successfully to acoes_pendentes.');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

main();