const test = require('node:test');
const assert = require('node:assert');
const proxyquire = require('proxyquire');

test('getDbStatus - should report both DBs independently', async () => {
  const mockPool = {
    query: async (sql) => {
      if (sql.includes('version()')) return { rows: [{ version: 'PostgreSQL 15' }] };
      throw new Error('Unexpected query');
    }
  };

  const mockEcoPool = {
    query: async () => { throw new Error('Eco DB Down'); }
  };

  const { getDbStatus } = proxyquire('../src/main/services/configService', {
    '../db': { pool: mockPool, ecoPool: mockEcoPool }
  });

  const status = await getDbStatus();

  assert.strictEqual(status.mirror.status, 'OK');
  assert.strictEqual(status.mirror.version, 'PostgreSQL 15');
  assert.strictEqual(status.ecosystem.status, 'ERROR');
  assert.strictEqual(status.ecosystem.error, 'Eco DB Down');
});

test('getDbStatus - should handle both DBs down', async () => {
  const mockPool = {
    query: async () => { throw new Error('Mirror Down'); }
  };

  const mockEcoPool = {
    query: async () => { throw new Error('Eco Down'); }
  };

  const { getDbStatus } = proxyquire('../src/main/services/configService', {
    '../db': { pool: mockPool, ecoPool: mockEcoPool }
  });

  const status = await getDbStatus();

  assert.strictEqual(status.mirror.status, 'ERROR');
  assert.strictEqual(status.mirror.error, 'Mirror Down');
  assert.strictEqual(status.ecosystem.status, 'ERROR');
  assert.strictEqual(status.ecosystem.error, 'Eco Down');
});

test('getSystemConfigs - should return rows', async () => {
  const mockEcoPool = {
    query: async () => ({ rows: [{ chave: 'test', valor: '123' }] })
  };
  const { getSystemConfigs } = proxyquire('../src/main/services/configService', {
    '../db': { ecoPool: mockEcoPool }
  });
  const res = await getSystemConfigs();
  assert.strictEqual(res.rows[0].chave, 'test');
});

test('setSystemConfig - should execute insert/update', async () => {
  const captured = [];
  const mockEcoPool = {
    query: async (sql, params) => {
      captured.push({ sql, params });
      return { rowCount: 1 };
    }
  };
  const { setSystemConfig } = proxyquire('../src/main/services/configService', {
    '../db': { ecoPool: mockEcoPool }
  });
  await setSystemConfig('key', 'val');
  assert.ok(captured[0].sql.includes('INSERT INTO config_sistema'));
  assert.deepStrictEqual(captured[0].params, ['key', 'val']);
});
