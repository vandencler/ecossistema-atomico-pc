
const cwd = process.cwd();
if (!cwd.toLowerCase().includes('-pc')) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error('This script MUST be executed from D:\projetos\ecossistema-atomico-pc');
    process.exit(1);
}

const { pool } = require('../src/main/db');

async function verify() {
  const idproduto = '0100000001'; // Sample ID
  const query = `
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT idpessoa, SUM(qtitem) as total_qty
    FROM wshop.docitem
    WHERE idproduto = CAST($1 AS text)
    GROUP BY idpessoa
    LIMIT 10
  `;

  try {
    console.log('=== Index Usage Verification (idx_docitem_idproduto) ===');
    const res = await pool.query(query, [idproduto]);
    res.rows.forEach(row => {
      console.log(row['QUERY PLAN']);
    });
  } catch (e) {
    console.error('Failed to verify index usage:', e.message);
  } finally {
    process.exit(0);
  }
}

verify();
