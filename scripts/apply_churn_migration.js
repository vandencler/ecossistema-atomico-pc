const { ecoPool } = require('../src/main/db');

async function applyMigrations() {
  console.log('[DS-MIGRATE] Aplicando colunas de razão à tabela ml_churn_risk...');
  try {
    await ecoPool.query(`
      ALTER TABLE ml_churn_risk ADD COLUMN IF NOT EXISTS reason_code VARCHAR(100);
      ALTER TABLE ml_churn_risk ADD COLUMN IF NOT EXISTS reason_detail TEXT;
    `);
    console.log('[DS-MIGRATE] Sucesso.');
  } catch (e) {
    console.error('[DS-MIGRATE] Erro:', e.message);
  } finally {
    process.exit(0);
  }
}

applyMigrations();
