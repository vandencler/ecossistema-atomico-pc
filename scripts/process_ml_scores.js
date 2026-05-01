const fs = require('fs');
const path = require('path');
const { ecoPool } = require('../src/main/db');

/**
 * EAV Machine Learning Processor (Lightweight Statistical Model)
 * This script simulates an external Data Science pipeline.
 * It reads the ETL CSVs, applies statistical scoring, and updates the EAV database.
 */

const outputDir = path.join(process.cwd(), 'ml_data');
const churnFile = path.join(outputDir, 'ml_churn_training.csv');
const affinityFile = path.join(outputDir, 'ml_affinity_training.csv');

async function processChurnScores() {
  if (!fs.existsSync(churnFile)) {
    console.log('[ML-ENGINE] Arquivo de churn nao encontrado. Execute a extracao (export_ml_data) primeiro.');
    return;
  }

  console.log('[ML-ENGINE] Processando modelo de Evasão (Churn)...');
  const data = fs.readFileSync(churnFile, 'utf8').split('\n').filter(Boolean).slice(1);
  
  const client = await ecoPool.connect();
  try {
    await client.query('BEGIN');

    for (const row of data) {
      const [idpessoa, recency, frequency] = row.split(',');
      if (!idpessoa || !recency) continue;

      // Statistical Heuristic: High recency + High frequency drop-off = High Risk
      const rec = parseInt(recency, 10);
      const freq = parseInt(frequency, 10);
      
      let riskScore = 0.0;
      let confidence = 50.0;

      if (rec > 180) {
        riskScore = 85.0; // Very likely churned
        confidence = 90.0;
      } else if (rec > 90) {
        riskScore = 65.0; // At risk
        confidence = 75.0;
      } else if (rec > 30) {
        riskScore = 30.0; // Drifting
        confidence = 60.0;
      } else {
        riskScore = 5.0; // Active
        confidence = 80.0;
      }

      // Modifier based on historical frequency
      if (freq > 10 && rec > 60) {
        riskScore = Math.min(100, riskScore + 20); // Sudden drop-off from VIP
        confidence = Math.min(100, confidence + 10);
      }

      const nextPurchaseDate = new Date();
      nextPurchaseDate.setDate(nextPurchaseDate.getDate() + Math.max(1, 30 - (freq || 1)));

      await client.query(`
        INSERT INTO ml_churn_risk (idpessoa, risk_score, confidence, next_purchase_estimate, model_version)
        VALUES ($1, $2, $3, $4, 'v1.0-stat')
        ON CONFLICT (idpessoa) DO UPDATE SET
          risk_score = EXCLUDED.risk_score,
          confidence = EXCLUDED.confidence,
          next_purchase_estimate = EXCLUDED.next_purchase_estimate,
          calculado_em = CURRENT_TIMESTAMP
      `, [idpessoa, riskScore, confidence, nextPurchaseDate.toISOString().split('T')[0]]);
    }

    await client.query('COMMIT');
    console.log(`[ML-ENGINE] Ingestao de Churn concluida para ${data.length} clientes.`);
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

  console.log('[ML-ENGINE] Processando modelo de Afinidade (Next Best Action)...');
  const data = fs.readFileSync(affinityFile, 'utf8').split('\n').filter(Boolean).slice(1);
  
  const client = await ecoPool.connect();
  try {
    await client.query('BEGIN');

    for (const row of data) {
      const [idpessoa, idproduto, qtd_total] = row.split(',');
      if (!idpessoa || !idproduto) continue;

      // Simplified Statistical Model for Affinity
      // In a real pipeline, this would use collaborative filtering.
      // Here, we convert historical volume into an affinity score.
      const qty = parseInt(qtd_total, 10);
      const affinityScore = Math.min(100, (qty * 5.5)); 
      const reasonCode = qty > 10 ? 'HIGH_HISTORICAL_VOLUME' : 'BOUGHT_PREVIOUSLY';

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
  console.log('=== Iniciando ML Processing Pipeline ===');
  await processChurnScores();
  await processAffinityScores();
  console.log('=== Pipeline Concluido ===');
  process.exit(0);
}

run();