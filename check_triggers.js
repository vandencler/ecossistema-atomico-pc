const { ecoPool } = require('./src/main/db');
ecoPool.query(`SELECT tgname FROM pg_trigger WHERE tgrelid = 'clientes_enriquecidos'::regclass`)
  .then(res => console.log(res.rows))
  .catch(console.error)
  .finally(() => process.exit());
