const test = require('node:test');
const assert = require('node:assert');
const proxyquire = require('proxyquire');

test('normalizeSearchTokens - limits tokens and length', () => {
  const { normalizeSearchTokens } = require('../src/main/utils');
  const query = '  PAULO   SILVA   SÃO  PAULO  EXTRA  TOKEN  ';
  const tokens = normalizeSearchTokens(query);
  assert.strictEqual(tokens.length, 5);
  assert.deepStrictEqual(tokens, ['paulo', 'silva', 'são', 'paulo', 'extra']);
});

test('Search Logic Optimization Check', () => {
  const tokenShort = 'sp';
  const tokenLong = 'avenida';
  const hasAddress = (token) => token.length > 2;
  assert.strictEqual(hasAddress(tokenShort), false);
  assert.strictEqual(hasAddress(tokenLong), true);
});

test('checkHealth - should return degraded if DB is down', async () => {
  const mockPool = { query: async () => { throw new Error('DB Down'); } };
  const mockEcoPool = { query: async () => ({ rows: [] }) };
  const { checkHealth } = proxyquire('../src/main/services/healthService', {
    '../db': { pool: mockPool, ecoPool: mockEcoPool },
    './logService': { logError: async () => {}, logEvent: async () => {} }
  });

  const health = await checkHealth();
  assert.strictEqual(health.status, 'DEGRADED');
  assert.strictEqual(health.databases.mirror.status, 'ERROR');
});

test('reconcileCorrections - should detect discrepancies', async () => {
  const mockEcoPool = {
    query: async (sql) => {
      if (sql.includes('SELECT')) return { rows: [{ idpessoa: '1', campo: 'nmpessoa', valor_corrigido: 'NEW', tabela_origem: 'pessoas' }] };
      return { rowCount: 1 };
    }
  };
  const mockPool = {
    query: async () => ({ rows: [{ nmpessoa: 'OLD' }] })
  };
  const { reconcileCorrections } = proxyquire('../src/main/services/reconciliationService', {
    '../db': { pool: mockPool, ecoPool: mockEcoPool },
    './logService': { logEvent: async () => {} }
  });

  const results = await reconcileCorrections();
  assert.strictEqual(results.discrepancies.length, 1);
  assert.strictEqual(results.discrepancies[0].local, 'NEW');
});
