
const test = require('node:test');
const assert = require('node:assert');
const { pool } = require('../src/main/db');

test('Phone Search Performance Verification', async () => {
  const query = '9999';
  const start = Date.now();
  
  const result = await pool.query(`
    EXPLAIN ANALYZE
    SELECT idpessoa, nmpessoa 
    FROM wshop.pessoas 
    WHERE campostelwhatsapp ILIKE $1 
    OR nrtelefone ILIKE $1 
    LIMIT 25
  `, [`%${query}%`]);
  
  const plan = result.rows.map(row => row['QUERY PLAN']).join('\n');
  const duration = Date.now() - start;
  
  console.log(`Phone Search Duration: ${duration}ms`);
  console.log('Plan:', plan);
  
  // This is EXPECTED to be a Seq Scan right now because EAV-101 is blocked
  const isSeqScan = plan.includes('Seq Scan on pessoas');
  console.log(`Is Seq Scan: ${isSeqScan}`);
  
  // We want to confirm it IS a seq scan to prove the bottleneck
  assert.ok(isSeqScan, 'Phone search should be a Seq Scan right now (Bottleneck confirmed)');
});
