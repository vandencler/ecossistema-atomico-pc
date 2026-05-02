const { ecoPool } = require('../src/main/db');

async function generateRetentionHooks() {
  console.log('[ML-RETENTION] Gerando hooks de reversao de churn...');
  
  const client = await ecoPool.raw.connect();
  try {
    // 1. Identify high risk clients
    const churnRes = await client.query(`
      SELECT idpessoa, risk_score 
      FROM ml_churn_risk 
      WHERE risk_score > 60 AND confidence > 60
    `);
    
    if (churnRes.rowCount === 0) {
      console.log('[ML-RETENTION] Nenhum cliente em alto risco encontrado.');
      return;
    }

    console.log(`[ML-RETENTION] Analisando ${churnRes.rowCount} clientes em risco...`);

    // 2. For each client, find their "Core" products
    // We'll use the already computed affinity which has 'CORE_PRODUCT' or 'HIGH_HISTORICAL_VOLUME'
    
    await client.query('BEGIN');
    let hookCount = 0;

    for (const row of churnRes.rows) {
      const { idpessoa, risk_score } = row;
      
      // Find top 2 favorite products
      const coreRes = await client.query(`
        SELECT idproduto, affinity_score, reason_code
        FROM ml_product_affinity
        WHERE idpessoa = $1 AND reason_code IN ('CORE_PRODUCT', 'HIGH_HISTORICAL_VOLUME', 'BOUGHT_PREVIOUSLY')
        ORDER BY affinity_score DESC
        LIMIT 2
      `, [idpessoa]);

      for (const core of coreRes.rows) {
        // Boost affinity score and mark as CHURN_REVERSAL_HOOK
        const boostedScore = Math.min(100, core.affinity_score + 10);
        await client.query(`
          INSERT INTO ml_product_affinity (idpessoa, idproduto, affinity_score, reason_code)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (idpessoa, idproduto) DO UPDATE SET
            affinity_score = GREATEST(ml_product_affinity.affinity_score, EXCLUDED.affinity_score),
            reason_code = 'CHURN_REVERSAL_HOOK',
            calculado_em = CURRENT_TIMESTAMP
        `, [idpessoa, core.idproduto, boostedScore, 'CHURN_REVERSAL_HOOK']);
        hookCount++;
      }
    }

    await client.query('COMMIT');
    console.log(`[ML-RETENTION] Ingestao de hooks concluida: ${hookCount} ganchos de retencao criados.`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[ML-RETENTION] Erro no processamento de retencao:', e.message);
  } finally {
    client.release();
  }
}

async function run() {
  await generateRetentionHooks();
  process.exit(0);
}

run();
