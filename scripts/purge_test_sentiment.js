const { ecoPool } = require('../src/main/db');

async function purgeTestSentiment() {
  console.log('[DS-CLEANUP] Purging test sessions from sentiment tables...');
  const testIds = ['TEST_USER_UI', 'usuario@DESKTOP-9HCET0A', 'TEST_CLIENT_001', 'TEST_REP_001'];
  
  try {
    const res1 = await ecoPool.query("DELETE FROM app_feedback WHERE user_id = ANY($1::text[])", [testIds]);
    console.log(`[DS-CLEANUP] Deleted ${res1.rowCount} records from app_feedback.`);
    
    const res2 = await ecoPool.query("DELETE FROM nps_scores WHERE user_id = ANY($1::text[]) OR idpessoa = ANY($1::text[])", [testIds]);
    console.log(`[DS-CLEANUP] Deleted ${res2.rowCount} records from nps_scores.`);
    
    const res3 = await ecoPool.query("DELETE FROM ml_client_sentiment WHERE idpessoa = ANY($1::text[])", [testIds]);
    console.log(`[DS-CLEANUP] Deleted ${res3.rowCount} records from ml_client_sentiment.`);

  } catch (err) {
    console.error('[DS-CLEANUP] Erro:', err.message);
  } finally {
    process.exit(0);
  }
}

purgeTestSentiment();
