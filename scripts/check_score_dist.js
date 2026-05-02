const { ecoPool } = require('../src/main/db');

async function run() {
  try {
    const res = await ecoPool.query(`
      SELECT 
        CASE 
          WHEN score_engajamento > 80 THEN 'High (>80)'
          WHEN score_engajamento > 60 THEN 'Medium-High (60-80)'
          WHEN score_engajamento > 40 THEN 'Medium (40-60)'
          ELSE 'Low (<40)'
        END as category,
        COUNT(*) as count
      FROM clientes_enriquecidos
      GROUP BY 1 ORDER BY 1
    `);
    console.log('Score Distribution:');
    res.rows.forEach(r => console.log(`- ${r.category}: ${r.count}`));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

run();
