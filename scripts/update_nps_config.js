const { ecoPool } = require('../src/main/db');

async function updateConfig() {
  try {
    await ecoPool.query(`
      UPDATE config_sistema 
      SET valor = '2' 
      WHERE chave = 'nps_survey_delay_days'
    `);
    console.log('✅ NPS delay updated to 2 days');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

updateConfig();
