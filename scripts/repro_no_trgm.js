const { searchClient } = require('../src/main/services/clientService');
const health = require('../src/main/services/healthService');

async function test() {
  const q = 'test';
  console.log(`Testing query: "${q}" with hasTrgm=false`);
  
  // Mock getIndexMap to return hasTrgm=false
  const originalGetIndexMap = health.getIndexMap;
  health.getIndexMap = async () => ({
    hasTrgmExtension: false
  });

  const { pool } = require('../src/main/db');
  const originalQuery = pool.query;
  pool.query = async (sql, params) => {
    console.log('SQL:', sql);
    console.log('Params:', params);
    return originalQuery.call(pool, sql, params);
  };

  try {
    const res = await searchClient(q);
    if (res.error) {
      console.error('❌ Error:', res.error);
    } else {
      console.log('✅ Success');
    }
  } catch (e) {
    console.error('Caught error:', e);
  } finally {
    health.getIndexMap = originalGetIndexMap;
    pool.query = originalQuery;
  }
  process.exit(0);
}

test();
