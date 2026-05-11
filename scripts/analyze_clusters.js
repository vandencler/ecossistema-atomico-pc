const { ecoPool } = require('../src/main/db');
async function analyzeClusters() {
  console.log('--- Churn Risk Cluster Analysis ---');
  
  const res = await ecoPool.query(`
    SELECT 
      p.cidade, 
      COUNT(*) as total_clientes,
      AVG(CAST(r.risk_score AS numeric)) as avg_risk,
      COUNT(*) FILTER (WHERE CAST(r.risk_score AS numeric) > 75) as high_risk_count
    FROM ml_client_profiles p
    JOIN ml_churn_risk r ON p.idpessoa = r.idpessoa
    GROUP BY p.cidade
    HAVING COUNT(*) > 10
    ORDER BY high_risk_count DESC
    LIMIT 10
  `);
  
  console.log('Top 10 Cities by High Risk Count:');
  console.table(res.rows);

  const res2 = await ecoPool.query(`
    SELECT 
      reason_code,
      COUNT(*) as count,
      AVG(CAST(risk_score AS numeric)) as avg_score
    FROM ml_churn_risk
    GROUP BY reason_code
    ORDER BY count DESC
  `);
  
  console.log('\nRisk Distribution by Reason:');
  console.table(res2.rows);

  process.exit(0);
}
analyzeClusters();
