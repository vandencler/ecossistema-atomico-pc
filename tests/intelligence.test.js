const test = require('node:test');
const assert = require('node:assert');
const proxyquire = require('proxyquire');

const mockEcoPool = {
  query: async () => ({ rows: [] }) // Default to returning no ML data
};

const intelligenceService = proxyquire('../src/main/services/intelligenceService', {
  '../db': { ecoPool: mockEcoPool }
});

test('IntelligenceService - calculatePriority - Birthday Bonus', async () => {
  const data = {
    idpessoa: '1',
    aniversario_hoje: true,
    dias_sem_compra: 100,
    tipo_acao: 'DASHBOARD',
    origem: 'SISTEMA',
    criado_em: new Date()
  };
  // Base 30 + Birthday 20 + Recency 3 + Action 4 + Origin 5 = 62
  const score = await intelligenceService.calculatePriority(data);
  assert.strictEqual(score, 62);
});

test('IntelligenceService - calculatePriority - Recency & Manual Bonus', async () => {
  const data = {
    idpessoa: '1',
    aniversario_hoje: false,
    dias_sem_compra: 15,
    tipo_acao: 'ALTERAR_CAMPO',
    origem: 'MANUAL',
    criado_em: new Date()
  };
  // Base 30 + Recency 16 + Action 10 + Origin 15 = 71
  const score = await intelligenceService.calculatePriority(data);
  assert.strictEqual(score, 71);
});

test('IntelligenceService - calculatePriority - ABC Ranking Bonus', async () => {
  const data = {
    idpessoa: '1',
    abc: 'A',
    aniversario_hoje: false,
    dias_sem_compra: 45, // Warm (8)
    tipo_acao: 'DASHBOARD',
    origem: 'SISTEMA',
    criado_em: new Date()
  };
  // Base 30 + ABC A 25 + Recency 8 + Action 4 + Origin 5 = 72
  const score = await intelligenceService.calculatePriority(data);
  assert.strictEqual(score, 72);
});

test('IntelligenceService - calculatePriority - Churn Risk Escalation', async () => {
  const data = {
    idpessoa: '1',
    freq_dias: 10,
    dias_sem_compra: 15, // > 1.3 * freq
    tipo_acao: 'DASHBOARD',
    origem: 'SISTEMA',
    criado_em: new Date()
  };
  // Base 30 + Recency 16 + Action 4 + Origin 5 + Churn 15 = 70
  const score = await intelligenceService.calculatePriority(data);
  assert.strictEqual(score, 70);
});

test('IntelligenceService - calculatePriority - Persistence Score (Age)', async () => {
  const twentyFiveHoursAgo = new Date(Date.now() - 25 * 3600000);
  const data = {
    idpessoa: '1',
    aniversario_hoje: false,
    dias_sem_compra: 100,
    tipo_acao: 'DASHBOARD',
    origem: 'SISTEMA',
    criado_em: twentyFiveHoursAgo
  };
  // Base 30 + Origin 5 + Action 4 + Recency 3 + Age 1 = 43
  const score = await intelligenceService.calculatePriority(data);
  assert.strictEqual(score, 43);
});

test('IntelligenceService - generateInsights - Bloqueado status', async () => {
  const profile = { idpessoa: '1', stpessoa: 'B' };
  const stats = { freq_dias: 0 };
  const priorityData = { aniversario_hoje: false, dias_sem_compra: 10 };
  
  const insights = await intelligenceService.generateInsights(profile, stats, priorityData);
  assert.ok(insights.includes('Cliente Bloqueado ⚠️'));
});

test('IntelligenceService - generateInsights - Churn Prediction', async () => {
  const profile = { idpessoa: '1', stpessoa: 'C' };
  const stats = { freq_dias: 10 };
  const priorityData = { aniversario_hoje: false, dias_sem_compra: 21 }; // > 2 * freq
  
  const insights = await intelligenceService.generateInsights(profile, stats, priorityData);
  assert.ok(insights.includes('Alto Risco de Churn (2x ciclo medio)'));
});

test('IntelligenceService - generateInsights - High LTV', async () => {
  const profile = { idpessoa: '1', stpessoa: 'C' };
  const stats = { valor_lifetime: 6000 };
  const priorityData = { abc: 'B', dias_sem_compra: 10 };
  
  const insights = await intelligenceService.generateInsights(profile, stats, priorityData);
  assert.ok(insights.includes('Alto valor acumulado (LTV)'));
});

test('IntelligenceService - getProductRecommendations', async () => {
  const mockRecs = [
    { idproduto: 'P1', affinity_score: 95.5, reason_code: 'BOUGHT_TOGETHER' },
    { idproduto: 'P2', affinity_score: 80.0, reason_code: 'SIMILAR_PROFILE' }
  ];
  
  const mockEcoPoolWithRecs = {
    query: async (sql) => {
      if (sql.includes('ml_product_affinity')) return { rows: mockRecs };
      return { rows: [] };
    }
  };

  const serviceWithRecs = proxyquire('../src/main/services/intelligenceService', {
    '../db': { ecoPool: mockEcoPoolWithRecs }
  });

  const recs = await serviceWithRecs.getProductRecommendations('1', 5);
  assert.strictEqual(recs.length, 2);
  assert.strictEqual(recs[0].idproduto, 'P1');
  assert.strictEqual(recs[1].affinity_score, 80.0);
});
