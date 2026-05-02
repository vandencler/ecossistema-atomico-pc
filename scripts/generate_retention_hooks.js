
const cwd = process.cwd();
if (!cwd.toLowerCase().includes("-pc")) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error("This script MUST be executed from D:\projetos\ecossistema-atomico-pc");
    process.exit(1);
}

const { ecoPool } = require('../src/main/db');

async function generateRetentionHooks() {
  console.log('[ML-RETENTION] Gerando hooks de reversao de churn...');
  
  const client = await ecoPool.raw.connect();
  try {
    // 1. Identify High Risk Clients (Churn v1.2)
    const riskRes = await client.query(`
      SELECT idpessoa, risk_score 
      FROM ml_churn_risk 
      WHERE CAST(risk_score AS numeric) > 75
    `);

    console.log(`[ML-RETENTION] Analisando ${riskRes.rowCount} clientes de alto risco.`);

    await client.query('BEGIN');
    let hooksCreated = 0;

    for (const row of riskRes.rows) {
      const idpessoa = row.idpessoa;
      const risk_score = parseFloat(row.risk_score);

      // 2. Find their most bought product (Essencial or Previous)
      const affinityRes = await client.query(`
        SELECT idproduto, affinity_score, reason_code
        FROM ml_product_affinity
        WHERE idpessoa = $1 AND reason_code IN ('CORE_PRODUCT', 'BOUGHT_PREVIOUSLY', 'HIGH_HISTORICAL_VOLUME')
        ORDER BY 
          CASE WHEN reason_code = 'CORE_PRODUCT' THEN 1 
               WHEN reason_code = 'HIGH_HISTORICAL_VOLUME' THEN 2 
               ELSE 3 END,
          CAST(affinity_score AS numeric) DESC
        LIMIT 1
      `, [idpessoa]);

      if (affinityRes.rowCount > 0) {
        const core = affinityRes.rows[0];
        const boostedScore = Math.min(100, parseFloat(core.affinity_score) + (risk_score / 10));

        // 3. Insert specific retention reason
        await client.query(`
          INSERT INTO ml_product_affinity (idpessoa, idproduto, affinity_score, reason_code, pitch)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (idpessoa, idproduto) DO UPDATE SET
            affinity_score = GREATEST(CAST(ml_product_affinity.affinity_score AS numeric), EXCLUDED.affinity_score),
            reason_code = 'CHURN_REVERSAL_HOOK',
            pitch = EXCLUDED.pitch,
            calculado_em = CURRENT_TIMESTAMP
        `, [idpessoa, core.idproduto, boostedScore, 'CHURN_REVERSAL_HOOK', 'Temos uma oferta especial para você repor seu produto favorito!']);
        
        hooksCreated++;
      }
    }

    await client.query('COMMIT');
    console.log(`[ML-RETENTION] Concluido. ${hooksCreated} hooks de reversao gerados.`);
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
