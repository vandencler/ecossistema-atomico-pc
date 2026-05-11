const { ecoPool } = require('../src/main/db');
async function check() {
  const feedbackRes = await ecoPool.query("SELECT COUNT(*) FROM app_feedback");
  console.log('Total app_feedback records:', feedbackRes.rows[0].count);
  
  const npsRes = await ecoPool.query("SELECT COUNT(*) FROM nps_scores");
  console.log('Total nps_scores records:', npsRes.rows[0].count);
  
  if (feedbackRes.rows[0].count > 0) {
    const feedbackData = await ecoPool.query("SELECT satisfaction, comment FROM app_feedback ORDER BY criado_em DESC LIMIT 10");
    console.log('Recent feedback:');
    console.table(feedbackData.rows);
  }
  
  process.exit(0);
}
check();
