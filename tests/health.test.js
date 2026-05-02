const test = require('node:test');
const assert = require('node:assert');
const proxyquire = require('proxyquire');

const mockPool = {
  throttler: { getStats: () => ({ queueLength: 0 }) },
  query: async (sql) => {
    if (sql.includes('pg_indexes')) {
      return { rows: [] }; // No trigram indexes
    }
    return { rows: [{ '1': 1 }] };
  }
};

const mockEcoPool = {
  throttler: { getStats: () => ({ queueLength: 0 }) },
  query: async () => ({ rows: [{ '1': 1 }] })
};

const mockLocalDb = {
  getLocalDb: () => ({
    prepare: () => ({
      get: () => ({ count: 150 })
    })
  })
};

const { checkHealth } = proxyquire('../src/main/services/healthService', {
  '../db': { pool: mockPool, ecoPool: mockEcoPool },
  '../localDb': mockLocalDb,
  './logService': { logError: async () => {}, logEvent: async () => {} }
});

test('checkHealth - should detect missing indexes', async () => {
  const health = await checkHealth();
  assert.strictEqual(health.databases.mirror.indexesOptimized, false);
  assert.strictEqual(health.databases.mirror.status, 'OK_BUT_UNOPTIMIZED');
  assert.strictEqual(health.databases.ecosystem.cacheRows, 150);
});
