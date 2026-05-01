const { searchClient } = require('../src/main/services/clientService');

async function test() {
  const q = 'test';
  console.log(`Testing query: "${q}"`);
  // searchClient doesn't export the SQL, but I can mock the pool.query to see it.
  const { pool } = require('../src/main/db');
  const originalQuery = pool.query;
  pool.query = async (sql, params) => {
    console.log('SQL:', sql);
    console.log('Params:', params);
    return originalQuery.call(pool, sql, params);
  };

  try {
    await searchClient(q);
  } catch (e) {
    console.error('Caught error:', e);
  }
  process.exit(0);
}

test();
