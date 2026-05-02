const fs = require('fs');
const path = require('path');
const { ecoPool } = require('../src/main/db');

/**
 * EAV Machine Learning Processor (Simulated Supervised Model)
 * This script implements a weighted scoring system that mimics a Logistic Regression model.
 * It uses expanded features (RFM + Diversity + Basket Size) to improve churn precision.
 */

const outputDir = path.join(process.cwd(), 'ml_data');
const churnFile = path.join(outputDir, 'ml_churn_training.csv');
const affinityFile = path.join(outputDir, 'ml_affinity_training.csv');

// Sigmoid function for probability mapping
function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

async function processChurnScores() {
  if (!fs.existsSync(churnFile)) {
    console.log('[ML-ENGINE] Arquivo de churn nao encontrado. Execute a extracao (export_ml_data) primeiro.');
    return;
  }

  console.log('[ML-ENGINE] Processando modelo de Evasão (Churn v1.2-supervised)...');
  const data = fs.readFileSync(churnFile, 'utf8').split('\n').filter(Boolean).slice(1);
  
  const client = await ecoPool.raw.connect();
  try {
    // Pre-fetch profile status for all clients to avoid joining in loop
    const profileRes = await client.query('SELECT idpessoa, stcredbloqueado FROM ml_client_profiles');
    const profiles = {};
    profileRes.rows.forEach(r => profiles[r.idpessoa] = r.stcredbloqueado);

    await client.query('BEGIN');

    for (const row of data) {
      const [idpessoa, recency, frequency, monetary, tenure, avg_basket, group_div] = row.split(',');
      if (!idpessoa || recency === undefined) continue;

      const rec = parseFloat(recency);
      const freq = parseFloat(frequency || 0);
      const val = parseFloat(monetary || 0);
      const ten = parseFloat(tenure || 0);
      const basket = parseFloat(avg_basket || 0);
      const div = parseFloat(group_div || 0);
      const isBlocked = profiles[idpessoa] === true;
      
      /**
       * SIMULATED LOGISTIC REGRESSION WEIGHTS
       */
      let z = -2.5; 
      
      z += rec * 0.04;        
      z -= freq * 0.15;       
      z -= Math.log10(val + 1) * 0.2; 
      z -= (div > 3 ? 0.8 : 0); 
      z -= (ten > 365 ? 0.5 : 0); 
      z += (basket < 2 && freq > 5 ? 0.3 : 0); 
      
      // Feature: Credit Blocked (Significant risk of non-engagement)
      if (isBlocked) z += 1.5;

      const probability = sigmoid(z);
      const riskScore = probability * 100;
      
      // Confidence mapping based on data density
      let confidence = 50.0;
      if (rec > 180 || rec < 15) confidence = 90.0; // Extreme cases are more certain
      else if (freq > 20) confidence = 85.0; // High data volume increases certainty
      else confidence = 65.0 + (Math.min(freq, 10) * 1.5);

      const nextPurchaseDate = new Date();
      nextPurchaseDate.setDate(nextPurchaseDate.getDate() + Math.max(1, Math.round(30 / (freq / 2 || 1))));

      await client.query(`
        INSERT INTO ml_churn_risk (idpessoa, risk_score, confidence, next_purchase_estimate, model_version)
        VALUES ($1, $2, $3, $4, 'v1.2-supervised-sim')
        ON CONFLICT (idpessoa) DO UPDATE SET
          risk_score = EXCLUDED.risk_score,
          confidence = EXCLUDED.confidence,
          next_purchase_estimate = EXCLUDED.next_purchase_estimate,
          model_version = EXCLUDED.model_version,
          calculado_em = CURRENT_TIMESTAMP
      `, [idpessoa, riskScore.toFixed(2), confidence.toFixed(2), nextPurchaseDate.toISOString().split('T')[0]]);
    }

    await client.query('COMMIT');
    console.log(`[ML-ENGINE] Ingestao de Churn concluida para ${data.length} clientes (v1.2).`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[ML-ENGINE] Erro no processamento de Churn:', e.message);
  } finally {
    client.release();
  }
}

async function processAffinityScores() {
  if (!fs.existsSync(affinityFile)) {
    console.log('[ML-ENGINE] Arquivo de afinidade nao encontrado.');
    return;
  }

  console.log('[ML-ENGINE] Processando modelo de Afinidade (Upsell/Volume)...');
  const data = fs.readFileSync(affinityFile, 'utf8').split('\n').filter(Boolean).slice(1);
  
  const client = await ecoPool.raw.connect();
  try {
    await client.query('BEGIN');

    for (const row of data) {
      const [idpessoa, idproduto, qtd_total] = row.split(',');
      if (!idpessoa || !idproduto) continue;

      const qty = parseFloat(qtd_total || 0);
      let affinityScore = Math.min(100, (qty * 7.5)); 
      let reasonCode = 'BOUGHT_PREVIOUSLY';
      
      if (qty > 20) {
        reasonCode = 'CORE_PRODUCT';
        affinityScore = Math.min(100, affinityScore + 15);
      } else if (qty > 10) {
        reasonCode = 'HIGH_HISTORICAL_VOLUME';
        affinityScore = Math.min(100, affinityScore + 5);
      }

      await client.query(`
        INSERT INTO ml_product_affinity (idpessoa, idproduto, affinity_score, reason_code)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (idpessoa, idproduto) DO UPDATE SET
          affinity_score = EXCLUDED.affinity_score,
          reason_code = EXCLUDED.reason_code,
          calculado_em = CURRENT_TIMESTAMP
      `, [idpessoa, idproduto, affinityScore, reasonCode]);
    }

    await client.query('COMMIT');
    console.log(`[ML-ENGINE] Ingestao de Afinidade concluida para ${data.length} relacoes.`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[ML-ENGINE] Erro no processamento de Afinidade:', e.message);
  } finally {
    client.release();
  }
}

async function run() {
  console.log('=== Iniciando ML Processing Pipeline v1.2 ===');
  await processChurnScores();
  await processAffinityScores();
  console.log('=== Pipeline Concluido ===');
  process.exit(0);
}

run();
