
const test = require('node:test');
const assert = require('node:assert');
const { pool } = require('../src/main/db');

test('Search Performance Verification (Regression)', async () => {
  const query = 'paulo';
  const start = Date.now();
  
  const result = await pool.query(`
    EXPLAIN ANALYZE
    SELECT idpessoa, nmpessoa 
    FROM wshop.pessoas 
    WHERE nmpessoa ILIKE $1 
    OR nmcurto ILIKE $1 
    LIMIT 25
  `, [`%${query}%`]);
  
  const plan = result.rows.map(row => row['QUERY PLAN']).join('\n');
  const duration = Date.now() - start;
  
  console.log(`Test Search Duration: ${duration}ms`);
  
  // Verify that the index is being used (should not be a Seq Scan)
  assert.ok(!plan.includes('Seq Scan on pessoas'), 'Search should use an index scan, not a sequential scan');
  assert.ok(plan.includes('Index Scan') || plan.includes('Bitmap Index Scan'), 'Search should utilize Trigram indexes');
});
