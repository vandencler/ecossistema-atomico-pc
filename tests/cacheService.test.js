const test = require('node:test');
const assert = require('node:assert');
const Database = require('better-sqlite3');
const proxyquire = require('proxyquire');

test('searchLocalCache - should include phones in search', async () => {
  // Setup in-memory SQLite for testing
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE client_cache (
      idpessoa TEXT PRIMARY KEY,
      nmpessoa TEXT,
      nmcurto TEXT,
      nrcgc_cic TEXT,
      dtultimacompra TEXT,
      nrtelefone TEXT,
      campostelwhatsapp TEXT,
      nrpager TEXT
    );
    INSERT INTO client_cache (idpessoa, nmpessoa, nmcurto, nrtelefone) 
    VALUES ('1', 'Joao Silva', 'Jao', '123456789');
    INSERT INTO client_cache (idpessoa, nmpessoa, nmcurto, nrtelefone) 
    VALUES ('2', 'Maria Souza', 'Maria', '987654321');
  `);

  const { searchLocalCache } = proxyquire('../src/main/services/cacheService', {
    '../db': { pool: {} },
    '../localDb': { getLocalDb: () => db },
    './logService': { logEvent: async () => {}, logError: async () => {} }
  });

  // Search by name
  const res1 = await searchLocalCache('Joao');
  assert.strictEqual(res1.rows.length, 1);
  assert.strictEqual(res1.rows[0].idpessoa, '1');

  // Search by phone
  const res2 = await searchLocalCache('987');
  assert.strictEqual(res2.rows.length, 1);
  assert.strictEqual(res2.rows[0].idpessoa, '2');

  // Multi-token search (name and phone)
  const res3 = await searchLocalCache('Joao 123');
  assert.strictEqual(res3.rows.length, 1);
  assert.strictEqual(res3.rows[0].idpessoa, '1');
});
