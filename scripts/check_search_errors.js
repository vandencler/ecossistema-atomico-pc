const { ecoPool } = require('../src/main/db');

async function main() {
  const res = await ecoPool.query("SELECT detalhe FROM log_eventos WHERE tipo = 'SEARCH_ERROR' ORDER BY criado_em DESC LIMIT 100");
  const errors = new Set();
  res.rows.forEach(row => {
    const firstLine = row.detalhe.split('\n')[0];
    errors.add(firstLine);
  });
  console.log('Unique Search Errors (last 100):');
  errors.forEach(e => console.log('- ' + e));
  process.exit(0);
}

main();
