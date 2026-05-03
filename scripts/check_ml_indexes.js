
const cwd = process.cwd();
if (!cwd.toLowerCase().includes('-pc')) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error('This script MUST be executed from D:\projetos\ecossistema-atomico-pc');
    process.exit(1);
}

const { ecoPool } = require('../src/main/db');

async function checkIndexes() {
  const indexes = [
    'idx_ml_churn_risk_freshness',
    'idx_ml_product_affinity_freshness',
    'idx_ml_client_sentiment_freshness',
    'idx_ml_client_profiles_freshness',
    'idx_ranking_cache_freshness'
  ];

  try {
    const res = await ecoPool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE indexname = ANY($1)
    `, [indexes]);
    
    console.log('Existing Indexes:', res.rows.map(r => r.indexname));
    
    const tableRes = await ecoPool.query(`
      SELECT tablename, tableowner 
      FROM pg_tables 
      WHERE tablename IN ('ml_churn_risk', 'ml_product_affinity', 'ml_client_sentiment', 'ml_client_profiles', 'ranking_cache')
    `);
    console.log('Table Ownership:', tableRes.rows);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

checkIndexes();
