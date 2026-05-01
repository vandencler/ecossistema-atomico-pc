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
    '../localDb': {
      getLocalDb: () => ({
        prepare: () => ({ all: () => [], run: () => {} })
      })
    }
  });

  return { service, mirrorQueries, ecoQueries, transitions };
}

test('performSync re-reads approved action and executes UPDATE only', async () => {
  const { service, mirrorQueries, transitions } = makeService();
  const result = await service.performSync([{ id: 123, campo: 'nmpessoa', valorLocal: 'NAO_CONFIAR' }], { usuario: 'tester' });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.syncedCount, 1);
  assert.strictEqual(mirrorQueries.length, 1);
  assert.match(mirrorQueries[0].sql, /^UPDATE wshop\.pessoas SET email = \$1 WHERE idpessoa = \$2$/);
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
  assert.match(result.results[0].sql, /^UPDATE wshop\.pessoas SET email = \$1 WHERE idpessoa = \$2$/);
});

test('generateBatchScript - should produce valid SQL and escape values', async () => {
  const ecoQueries = [];
  const mockEcoPool = {
    query: async (sql) => {
      ecoQueries.push(sql);
      if (sql.includes('SELECT') && sql.includes('acoes_pendentes')) {
        return {
          rowCount: 2,
          rows: [
            { id: 1, idpessoa: 'C1', campo: 'nmpessoa', valor_novo: "João d'Ávila", nome_pessoa: 'Joao' },
            { id: 2, idpessoa: 'C2', campo: 'nrtelefone', valor_novo: '9999', nome_pessoa: 'Maria' }
          ]
        };
      }
      return { rowCount: 0, rows: [] };
    }
  };

  const service = proxyquire('../src/main/services/syncService', {
    '../db': { pool: {}, ecoPool: mockEcoPool },
    './savService': { ACTION_STATUS: { DONE: 'CONCLUIDO' } },
    './logService': {},
    './telemetryService': {},
    '../localDb': { getLocalDb: () => ({ prepare: () => ({ all: () => [], run: () => {} }) }) }
  });

  const result = await service.generateBatchScript();
  assert.strictEqual(result.ok, true);
  assert.ok(result.sql.includes("UPDATE wshop.pessoas SET nmpessoa = 'João d''Ávila' WHERE idpessoa = 'C1'"));
  assert.ok(result.sql.includes("UPDATE wshop.pessoas SET nrtelefone = '9999' WHERE idpessoa = 'C2'"));
  assert.ok(result.sql.includes('BEGIN;'));
  assert.ok(result.sql.includes('COMMIT;'));
  assert.deepStrictEqual(result.ids, [1, 2]);
});
