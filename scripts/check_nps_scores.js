const { ecoPool } = require('../src/main/db');
async function check() {
  const res = await ecoPool.query("SELECT score, COUNT(*) FROM nps_scores WHERE status = 'RESPONDED' GROUP BY score ORDER BY score DESC");
  console.log('NPS Scores:');
  console.table(res.rows);
  
  const totalRes = await ecoPool.query("SELECT COUNT(*) FROM nps_scores WHERE status = 'RESPONDED'");
  const total = parseInt(totalRes.rows[0].count);
  
  const promotersRes = await ecoPool.query("SELECT COUNT(*) FROM nps_scores WHERE status = 'RESPONDED' AND score >= 9");
  const promoters = parseInt(promotersRes.rows[0].count);
  
  const detractorsRes = await ecoPool.query("SELECT COUNT(*) FROM nps_scores WHERE status = 'RESPONDED' AND score <= 6");
  const detractors = parseInt(detractorsRes.rows[0].count);
  
  if (total > 0) {
    const nps = ((promoters - detractors) / total) * 100;
    console.log(`Current NPS: ${nps.toFixed(2)}`);
    console.log(`Breakdown: Total: ${total}, Promoters: ${promoters}, Detractors: ${detractors}`);
  } else {
    console.log('No responded NPS scores yet.');
  }
  
  process.exit(0);
}
check();
