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
  const mockEcoPool = { query: async () => ({ rows: [{ count: 0 }] }) };
  const mockLocalDb = {
    getLocalDb: () => ({
      prepare: () => ({
        get: () => ({ count: 0 })
      })
    })
  };
  const { checkHealth } = proxyquire('../src/main/services/healthService', {
    '../db': { pool: mockPool, ecoPool: mockEcoPool },
    '../localDb': mockLocalDb,
    './logService': { logError: async () => {}, logEvent: async () => {} }
  });

  const health = await checkHealth();
  assert.strictEqual(health.status, 'DEGRADED');
  assert.strictEqual(health.databases.mirror.status, 'ERROR');
});

test('searchClient - should use granular indexMap for % vs LIKE', async () => {
  let capturedSql = '';
  const mockPool = {
    query: async (sql, _params) => {
      capturedSql = sql;
      return { rows: [] };
    }
  };

  const { searchClient } = proxyquire('../src/main/services/clientService', {
    '../db': { pool: mockPool, ecoPool: {} },
    './healthService': {
      isOfflineMode: async () => false,
      isSearchOptimized: async () => false,
      getIndexMap: async () => ({
        'hasTrgmExtension': true,
        'idx_pessoas_nmpessoa_trgm': true,
        'idx_pessoas_nmcurto_trgm': false,
        'idx_pessoas_cdchamada_trgm': true,
        'idx_pessoas_nrcgc_cic_trgm': false,
        'idx_pessoas_phones_trgm': true
      })
    },
    './telemetryService': { trackEvent: async () => {} },
    './logService': { logError: async () => {} },
    './cacheService': {},
    './intelligenceService': {}
  });

  await searchClient('joao');

  // nmpessoa has index, should use %
  assert.ok(capturedSql.includes('p.nmpessoa %'));
  // nmcurto has NO index, should use LIKE
  assert.ok(capturedSql.includes('LOWER(p.nmcurto) LIKE'));
  // cdchamada has index, should use %
  assert.ok(capturedSql.includes('LOWER(p.cdchamada) %'));
  // nrcgc_cic has NO index, should use LIKE
  assert.ok(capturedSql.includes('LOWER(p.nrcgc_cic) LIKE'));
  // phones has index, should use %
  assert.ok(capturedSql.includes("REGEXP_REPLACE(COALESCE(p.campostelwhatsapp,''), '[^0-9]', '', 'g') %"));
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
