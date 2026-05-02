
const cwd = process.cwd();
if (!cwd.toLowerCase().includes('-pc')) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error('This script MUST be executed from D:\projetos\ecossistema-atomico-pc');
    process.exit(1);
}

const fs = require('fs');
const path = require('path');
const { ecoPool } = require('../src/main/db');

/**
 * Data Science Health Check
 * Verifies the integrity and freshness of the ML pipeline artifacts and database tables.
 */

async function runHealthCheck() {
  console.log('=== DATA SCIENCE HEALTH CHECK ===\n');
  
  const results = {
    files: {},
    tables: {},
    distributions: {}
  };

  const mlDataDir = path.join(process.cwd(), 'ml_data');
  const expectedFiles = [
    'ml_churn_training.csv',
    'ml_affinity_training.csv',
    'ml_transactions_basket.csv',
    'evaluation_report_v1.2.json',
    'product_gender_bias.json'
  ];

  console.log('1. Verificando arquivos em ml_data/:');
  for (const file of expectedFiles) {
    const filePath = path.join(mlDataDir, file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const ageHours = (new Date() - stats.mtime) / (1000 * 60 * 60);
      console.log(`[OK] ${file.padEnd(30)} | ${(stats.size / 1024).toFixed(1)} KB | Idade: ${ageHours.toFixed(1)}h`);
      results.files[file] = { status: 'OK', ageHours };
    } else {
      console.log(`[FAIL] ${file.padEnd(30)} | ARQUIVO AUSENTE`);
      results.files[file] = { status: 'MISSING' };
    }
  }

  console.log('\n2. Verificando tabelas no Banco Ecosystem:');
  const expectedTables = [
    'ml_churn_risk',
    'ml_product_affinity',
    'ml_client_sentiment',
    'ml_client_profiles'
  ];

  for (const table of expectedTables) {
    try {
      const res = await ecoPool.query(`SELECT COUNT(*) as count, MAX(calculado_em) as last_run FROM ${table}`);
      const count = parseInt(res.rows[0].count);
      const lastRun = res.rows[0].last_run;
      console.log(`[OK] ${table.padEnd(25)}: ${count.toString().padStart(6)} registros | Último: ${lastRun ? lastRun.toISOString() : 'N/A'}`);
      results.tables[table] = { count, lastRun };
    } catch (e) {
      console.log(`[FAIL] ${table.padEnd(25)}: ${e.message}`);
      results.tables[table] = { error: e.message };
    }
  }

  console.log('\n3. Status da Fila SAV e Sincronização:');
  try {
    const savRes = await ecoPool.query(`
      SELECT status, COUNT(*) as count 
      FROM acoes_pendentes 
      GROUP BY 1 
      ORDER BY 2 DESC
    `);
    savRes.rows.forEach(r => console.log(` - Status ${r.status}: ${r.count}`));
  } catch (e) {
    console.log(`[FAIL] acoes_pendentes: ${e.message}`);
  }

  console.log('\n=== CHECK CONCLUÍDO ===');
}

runHealthCheck().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
