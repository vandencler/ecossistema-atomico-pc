const test = require('node:test');
const assert = require('node:assert');
const intelligenceService = require('../src/main/services/intelligenceService');

test('IntelligenceService - calculatePriority - Birthday Bonus', () => {
  const data = {
    aniversario_hoje: true,
    dias_sem_compra: 100,
    tipo_acao: 'DASHBOARD',
    origem: 'SISTEMA',
    criado_em: new Date()
  };
  // Base 30 + Birthday 20 + Recency 3 + Action 4 + Origin 8 + Age 0 = 65
  const score = intelligenceService.calculatePriority(data);
  assert.strictEqual(score, 65);
});

test('IntelligenceService - calculatePriority - Recency & Manual Bonus', () => {
  const data = {
    aniversario_hoje: false,
    dias_sem_compra: 15,
    tipo_acao: 'ALTERAR_CAMPO',
    origem: 'MANUAL',
    criado_em: new Date()
  };
  // Base 30 + Recency 16 + Action 10 + Origin 20 = 76
  const score = intelligenceService.calculatePriority(data);
  assert.strictEqual(score, 76);
});

test('IntelligenceService - calculatePriority - Persistence Score (Age)', () => {
  const fourHoursAgo = new Date(Date.now() - 4 * 3600000);
  const data = {
    aniversario_hoje: false,
    dias_sem_compra: 100,
    tipo_acao: 'DASHBOARD',
    origem: 'SISTEMA',
    criado_em: fourHoursAgo
  };
  // Base 30 + Origin 8 + Action 4 + Recency 3 + Age 0 = 45
  const score = intelligenceService.calculatePriority(data);
  assert.strictEqual(score, 45);
});

test('IntelligenceService - generateInsights - Bloqueado status', () => {
  const profile = { stpessoa: 'B' };
  const stats = { freq_dias: 0 };
  const priorityData = { aniversario_hoje: false, dias_sem_compra: 10 };
  
  const insights = intelligenceService.generateInsights(profile, stats, priorityData);
  assert.ok(insights.includes('Cliente Bloqueado ⚠️'));
});

test('IntelligenceService - generateInsights - Churn Prediction', () => {
  const profile = { stpessoa: 'C' };
  const stats = { freq_dias: 10 };
  const priorityData = { aniversario_hoje: false, dias_sem_compra: 20 }; // > 1.5 * freq
  
  const insights = intelligenceService.generateInsights(profile, stats, priorityData);
  assert.ok(insights.includes('Atraso no ciclo de compra detectado'));
});
