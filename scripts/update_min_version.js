const { ecoPool } = require('../src/main/db');

async function run() {
  try {
    await ecoPool.query("INSERT INTO config_sistema (chave, valor) VALUES ('min_app_version', '1.1.6') ON CONFLICT (chave) DO UPDATE SET valor = '1.1.6'");
    console.log('Enforcement updated to 1.1.6');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();
