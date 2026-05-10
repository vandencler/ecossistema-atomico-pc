const test = require('node:test');
const assert = require('node:assert');
const proxyquire = require('proxyquire');

function makeService() {
  const ecoQueries = [];
  const originalQueries = [];

  const mockEcoPool = {
    query: async (sql, params) => {
      ecoQueries.push({ sql, params });
      if (sql.includes('INSERT INTO purge_queue')) {
        return { rowCount: 1, rows: [{ id: 101 }] };
      }
      return { rowCount: 1, rows: [] };
    }
  };

  const mockOriginalPool = {
    query: async (sql, params) => {
      originalQueries.push({ sql, params });
      return { rowCount: 1, rows: [] };
    }
  };

  const service = proxyquire('../src/main/services/purgeService', {
    '../db': {
      ecoPool: mockEcoPool,
      originalPool: mockOriginalPool
    },
    './logService': {
      logEvent: async () => {},
      logError: async () => {}
    },
    './telemetryService': {
      trackEvent: async () => {}
    }
  });

  return { service, ecoQueries, originalQueries };
}

test('executeWriteBack logs to purge_queue and executes against originalPool', async () => {
  const { service, ecoQueries, originalQueries } = makeService();
  const result = await service.executeWriteBack(
    'TEST_OP',
    'wshop.pessoas',
    '123',
    { obs: 'new_value' },
    'tester'
  );

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.queueId, 101);

  // Check Eco Queries (Log intent and Mark Completed)
  assert.strictEqual(ecoQueries.length, 2);
  assert.ok(ecoQueries[0].sql.includes('INSERT INTO purge_queue'));
  assert.strictEqual(ecoQueries[0].params[0], 'TEST_OP');
  assert.ok(ecoQueries[1].sql.includes('UPDATE purge_queue'));
  assert.ok(ecoQueries[1].sql.includes("status = 'COMPLETED'"));

  // Check Original Queries (Production Write)
  assert.strictEqual(originalQueries.length, 1);
  assert.strictEqual(originalQueries[0].sql, 'UPDATE wshop.pessoas SET obs = $1 WHERE idpessoa = $2');
  assert.deepStrictEqual(originalQueries[0].params, ['new_value', '123']);
});

test('executeWriteBack handles errors and updates purge_queue status', async () => {
    const ecoQueries = [];
    const mockEcoPool = {
      query: async (sql, params) => {
        ecoQueries.push({ sql, params });
        if (sql.includes('INSERT INTO purge_queue')) {
          return { rowCount: 1, rows: [{ id: 102 }] };
        }
        return { rowCount: 1, rows: [] };
      }
    };
  
    const mockOriginalPool = {
      query: async () => {
        throw new Error('Prod connection failed');
      }
    };
  
    const service = proxyquire('../src/main/services/purgeService', {
      '../db': {
        ecoPool: mockEcoPool,
        originalPool: mockOriginalPool
      },
      './logService': { logEvent: async () => {}, logError: async () => {} },
      './telemetryService': { trackEvent: async () => {} }
    });
  
    const result = await service.executeWriteBack('TEST_FAIL', 'table', 'id', { f: 'v' });
  
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, 'Prod connection failed');
    assert.ok(ecoQueries.some(q => q.sql.includes('UPDATE purge_queue') && q.sql.includes("status = 'ERROR'")));
  });

test('normalize9thDigit identifies and normalizes correctly', async () => {
  const { service, originalQueries } = makeService();
  
  // 1. Test with unnormalized mobile number
  const res1 = await service.normalize9thDigit('123', {
    nrtelefone: '1188887777', // 10 digits, starts with 8 (mobile)
    nrpager: '1122223333'      // 10 digits, starts with 2 (landline)
  });

  assert.strictEqual(res1.ok, true);
  assert.strictEqual(res1.skipped, undefined);
  assert.strictEqual(originalQueries.length, 1);
  assert.deepStrictEqual(originalQueries[0].params, ['11988887777', '123']);
  assert.strictEqual(originalQueries[0].sql, 'UPDATE wshop.pessoas SET nrtelefone = $1 WHERE idpessoa = $2');

  // 2. Test with already normalized numbers
  const res2 = await service.normalize9thDigit('456', {
    nrtelefone: '11988887777',
    campostelwhatsapp: '15999692676'
  });
  assert.strictEqual(res2.ok, true);
  assert.strictEqual(res2.skipped, true);
  assert.strictEqual(originalQueries.length, 1); // No new query
});
