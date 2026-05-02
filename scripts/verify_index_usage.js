
const cwd = process.cwd();
if (!cwd.toLowerCase().includes('-pc')) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error('This script MUST be executed from D:\projetos\ecossistema-atomico-pc');
    process.exit(1);
}

const { pool } = require('../src/main/db');

async function verify() {
  const idpessoa = '01000018N3'; // Sample ID
  const query = `
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT pr.nmproduto, pr.cdchamada,
           SUM(di.qtitem) AS qtd_total,
           SUM(di.vlitem) AS valor_total,
           COUNT(DISTINCT di.iddocumento) AS vezes_comprado
    FROM wshop.docitem di
    JOIN wshop.produto pr ON pr.idproduto = di.idproduto
    JOIN wshop.documen d ON d.iddocumento = di.iddocumento
    WHERE di.idpessoa = CAST($1 AS text) AND d.tpoperacao = 'V'
      AND (d.stdocumentocancelado IS NULL OR d.stdocumentocancelado != 'S')
    GROUP BY pr.nmproduto, pr.cdchamada
    ORDER BY valor_total DESC
    LIMIT 10
  `;

  try {
    console.log('=== Index Usage Verification (idx_docitem_idpessoa) ===');
    const res = await pool.query(query, [idpessoa]);
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
