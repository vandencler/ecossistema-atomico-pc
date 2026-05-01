const test = require('node:test');
const assert = require('node:assert');
const proxyquire = require('proxyquire');

const mockPool = {
  query: async () => ({ rows: [] })
};

const mockEcoPool = {
  query: async (sql, _params) => {
    if (sql.includes('SELECT') && sql.includes('FROM acoes_pendentes')) {
      return {
        rowCount: 1,
        rows: [{ id: 1, idpessoa: '123', status: 'PENDENTE' }]
      };
    }
    return { rowCount: 1, rows: [] };
  },
  connect: async () => ({
    query: async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return;
      if (sql.includes('SELECT') && sql.includes('FOR UPDATE')) {
         return { rowCount: 1, rows: [{ id: 1, idpessoa: '123', status: 'PENDENTE' }] };
      }
      return { rowCount: 1, rows: [] };
    },
    release: () => {}
  })
};

const telemetry = {
  events: [],
  trackEvent: async (name, user, payload) => {
    telemetry.events.push({ name, user, payload });
  }
};

const { reviewActions } = proxyquire('../src/main/services/savService', {
  '../db': { pool: mockPool, ecoPool: mockEcoPool },
  './logService': { logEvent: async () => {}, logError: async () => {} },
  './telemetryService': telemetry,
  './intelligenceService': { calculatePriority: async () => 50 },
  './notificationService': { notifyExecutionError: () => {} }
});

test('reviewActions - should process batch and track telemetry', async () => {
  const payload = {
    ids: [1],
    decision: 'APROVADO',
    usuario: 'gestor-test'
  };

  const result = await reviewActions(payload);
  
  if (!result.ok) console.log(result);
  
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.status, 'APROVADO');
  assert.strictEqual(telemetry.events.length, 1);
  assert.strictEqual(telemetry.events[0].name, 'SAV_REVIEW_BATCH');
  assert.strictEqual(telemetry.events[0].user, 'gestor-test');
});
