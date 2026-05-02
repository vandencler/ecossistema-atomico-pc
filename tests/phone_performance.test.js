const test = require('node:test');
const assert = require('node:assert');
const { pool } = require('../src/main/db');

test('Phone Search Performance Verification (Optimized)', async () => {
  const query = '9999';
  const digitParam = \%\%\;
  const start = Date.now();

  const result = await pool.query(\
    EXPLAIN ANALYZE
    SELECT idpessoa, nmpessoa
    FROM wshop.pessoas p
    WHERE REGEXP_REPLACE(COALESCE(p.campostelwhatsapp,''), '[^0-9]', '', 'g') LIKE \
       OR REGEXP_REPLACE(COALESCE(p.nrtelefone,''), '[^0-9]', '', 'g') LIKE \
    LIMIT 25
  \, [digitParam]);

  const plan = result.rows.map(row => row['QUERY PLAN']).join('\n');
  const duration = Date.now() - start;

  console.log(\Optimized Phone Search Duration: \ms\);

  const usesIndex = plan.includes('Index Scan') || plan.includes('Bitmap Index Scan');
  assert.ok(usesIndex, 'Phone search should now utilize functional trigram indexes');
  assert.ok(duration < 200, 'Optimized phone search should be under 200ms');
});
