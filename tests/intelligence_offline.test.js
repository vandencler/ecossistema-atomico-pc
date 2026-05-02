const test = require('node:test');
const assert = require('node:assert');
const { initLocalDb, getLocalDb } = require('../src/main/localDb');
const path = require('path');
const fs = require('fs');

// We'll use proxyquire to simulate a failure in ecoPool
const proxyquire = require('proxyquire');

test('IntelligenceService Offline Fallback', async (t) => {
  const tmpDir = path.join(process.cwd(), 'temp_test_offline');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
  
  initLocalDb(tmpDir);
  const db = getLocalDb();

  // 1. Prepare local DB with some data
  db.exec(`
    INSERT OR REPLACE INTO ml_churn_risk (idpessoa, risk_score, confidence, model_version)
    VALUES ('OFFLINE_USER', 99.0, 95.0, 'v1-test')
  `);
  db.exec(`
    INSERT OR REPLACE INTO ml_product_affinity (idpessoa, idproduto, affinity_score, reason_code)
    VALUES ('OFFLINE_USER', 'PROD_OFFLINE', 90.0, 'OFFLINE_REASON')
  `);

  // 2. Mock ecoPool to fail
  const mockEcoPool = {
    query: async () => { throw new Error('Database is offline'); }
  };

  const intelligenceService = proxyquire('../src/main/services/intelligenceService', {
    '../db': { ecoPool: mockEcoPool }
  });

  await t.test('should fallback to local cache for churn scores', async () => {
    const scores = await intelligenceService._getMLScores('OFFLINE_USER');
    assert.strictEqual(scores.risk_score, 99.0);
    assert.strictEqual(scores.confidence, 95.0);
  });

  await t.test('should fallback to local cache for affinity recommendations', async () => {
    const recs = await intelligenceService.getProductRecommendations('OFFLINE_USER', 1);
    assert.strictEqual(recs.length, 1);
    assert.strictEqual(recs[0].idproduto, 'PROD_OFFLINE');
    assert.strictEqual(recs[0].affinity_score, 90.0);
  });

  await t.test('calculatePriority should use fallback scores', async () => {
    const data = {
      idpessoa: 'OFFLINE_USER',
      aniversario_hoje: false,
      dias_sem_compra: 10,
      tipo_acao: 'DASHBOARD',
      origem: 'SISTEMA',
      criado_em: new Date()
    };
    // Group A (OFFLINE_USER hashes to A): Base 30 + Action 4 + Origin 5 + Recency 16 + ML Risk A (15) + Affinity 10 = 80
    const score = await intelligenceService.calculatePriority(data);
    assert.strictEqual(score, 80);
  });

  // Cleanup after all tests in this file
  // fs.rmSync(tmpDir, { recursive: true, force: true });
});
