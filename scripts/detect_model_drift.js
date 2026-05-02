const fs = require('fs');
const path = require('path');
const { ecoPool } = require('../src/main/db');

/**
 * Model Drift Detection Script
 * Compares current score distributions with the baseline distribution from v1.2 training.
 * Alerts if significant shifts are detected.
 */

async function detectDrift() {
  console.log('[ML-DRIFT] Iniciando detecção de desvio (Drift) do modelo...');
  
  try {
    // 1. Fetch current distribution
    const currentRes = await ecoPool.query(`
      SELECT 
        CASE 
          WHEN risk_score > 80 THEN 'High'
          WHEN risk_score > 50 THEN 'Medium'
          ELSE 'Low'
        END as bucket,
        COUNT(*) as count
      FROM ml_churn_risk
      GROUP BY 1
    `);

    const currentDist = {};
    let total = 0;
    currentRes.rows.forEach(r => {
      currentDist[r.bucket] = parseInt(r.count);
      total += currentDist[r.bucket];
    });

    if (total === 0) {
      console.log('[ML-DRIFT] Nenhum dado encontrado para análise.');
      return;
    }

    // Baseline (from initial v1.2 calibration)
    const baseline = {
      'High': 0.75,   // ~75% 
      'Medium': 0.15, // ~15%
      'Low': 0.10     // ~10%
    };

    console.log('Bucket | Current % | Baseline % | Status');
    console.log('-------|-----------|------------|-------');

    let hasSignificantDrift = false;
    for (const bucket in baseline) {
      const currentPct = (currentDist[bucket] || 0) / total;
      const baselinePct = baseline[bucket];
      const diff = Math.abs(currentPct - baselinePct);
      
      let status = '🟢 OK';
      if (diff > 0.15) {
        status = '🔴 DRIFT';
        hasSignificantDrift = true;
      } else if (diff > 0.08) {
        status = '🟡 WARNING';
      }

      console.log(`${bucket.padEnd(6)} | ${(currentPct * 100).toFixed(1)}%     | ${(baselinePct * 100).toFixed(1)}%      | ${status}`);
    }

    if (hasSignificantDrift) {
      console.warn('\n[ML-DRIFT] ATENÇÃO: Desvio significativo detectado. Recomenda-se recalibrar os pesos do modelo v1.2.');
      await ecoPool.query(`
        INSERT INTO log_eventos (tipo, idpessoa, detalhe, criado_em)
        VALUES ('SYSTEM_ALERT', '0', 'ML Model Drift Detected: Deviation > 15% from baseline in churn buckets.', NOW())
      `);
    } else {
      console.log('\n[ML-DRIFT] Modelo está operando dentro dos parâmetros de estabilidade.');
    }

  } catch (err) {
    console.error('[ML-DRIFT] Erro fatal:', err.message);
  } finally {
    process.exit(0);
  }
}

detectDrift();
