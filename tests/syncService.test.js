const test = require('node:test');
const assert = require('node:assert');
const proxyquire = require('proxyquire');

function makeService() {
  const mirrorQueries = [];
  const ecoQueries = [];
  const transitions = [];

  const mirrorClient = {
    query: async (sql, params) => {
      mirrorQueries.push({ sql, params });
      return { rowCount: 1, rows: [] };
    },
    release: () => {}
  };

  const ecoClient = {
    query: async (sql, params) => {
      ecoQueries.push({ sql, params });
      return { rowCount: 1, rows: [] };
    },
    release: () => {}
  };

  const mockEcoPool = {
    query: async (sql, params) => {
      ecoQueries.push({ sql, params });
      if (sql.includes('FROM acoes_pendentes') && sql.includes('WHERE id = $1')) {
        return {
          rowCount: 1,
          rows: [{
            id: params[0],
            idpessoa: '42',
            campo: 'email',
            valor_novo: 'novo@example.com',
            tipo_acao: 'ALTERAR_CAMPO',
            status: 'APROVADO'
          }]
        };
      }
      return { rowCount: 1, rows: [] };
    },
    connect: async () => ecoClient
  };

  const service = proxyquire('../src/main/services/syncService', {
    '../db': {
      pool: { connect: async () => mirrorClient },
      ecoPool: mockEcoPool
    },
    './savService': {
      ACTION_STATUS: { APPROVED: 'APROVADO' },
      markActionExecutionStarted: async (_client, id, usuario) => transitions.push(['start', id, usuario]),
      markActionExecutionDone: async (_client, id, usuario) => transitions.push(['done', id, usuario]),
      markActionExecutionError: async (_client, id, error, usuario) => transitions.push(['error', id, error.message, usuario])
    },
    './logService': {
      logEvent: async () => {},
      logError: async () => {}
    },
    './telemetryService': {
      trackEvent: async () => {}
    },
    './configService': {
      getConfigValue: async () => '1'
    },
    '../localDb': {
      getLocalDb: () => ({
        prepare: () => ({ all: () => [] })
      })
    }
  });

  return { service, mirrorQueries, ecoQueries, transitions };
}

test('performSync re-reads approved action and executes UPDATE only', async () => {
  const { service, mirrorQueries, transitions } = makeService();
  const result = await service.performSync([{ id: 123, campo: 'email', valorLocal: 'novo@example.com' }], { usuario: 'tester' });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.syncedCount, 1);
  assert.strictEqual(mirrorQueries.length, 1);
  assert.match(mirrorQueries[0].sql, /^UPDATE wshop\.pessoas SET email = \$1::text WHERE idpessoa = \$2::text$/);
  assert.ok(!mirrorQueries[0].sql.toUpperCase().includes('INSERT'));
  assert.deepStrictEqual(mirrorQueries[0].params, ['novo@example.com', '42']);
  assert.deepStrictEqual(transitions, [['start', 123, 'tester'], ['done', 123, 'tester']]);
});

test('performSync dryRun returns preview without writing to ERP target', async () => {
  const { service, mirrorQueries } = makeService();
  const result = await service.performSync([123], { dryRun: true });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.syncedCount, 0);
  assert.strictEqual(mirrorQueries.length, 0);
  assert.strictEqual(result.results[0].status, 'PREVIEW');
  assert.match(result.results[0].sql, /^UPDATE wshop\.pessoas SET email = \$1::text WHERE idpessoa = \$2::text$/);
});
