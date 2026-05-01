const { pool } = require('../src/main/db');

async function checkPlan() {
  const idpessoa = '0100DTXY0A';
  
  const sql = `
    EXPLAIN ANALYZE
    WITH recent_docs AS (
        SELECT iddocumento FROM wshop.documen 
        WHERE idpessoa = $1 AND tpoperacao = 'V'
          AND (stdocumentocancelado IS NULL OR stdocumentocancelado != 'S')
        ORDER BY dtemissao DESC LIMIT 10
      ),
      my_products AS (
        SELECT DISTINCT di.idproduto, pr.idgrupo
        FROM wshop.docitem di
        JOIN recent_docs rd ON rd.iddocumento = di.iddocumento
        JOIN wshop.produto pr ON pr.idproduto = di.idproduto
      ),
      my_groups AS (
        SELECT idgrupo, COUNT(*) as weight
        FROM my_products
        GROUP BY idgrupo
      ),
      similar_customers AS (
        SELECT DISTINCT di2.idpessoa
        FROM wshop.docitem di2
        JOIN wshop.documen d2 ON d2.iddocumento = di2.iddocumento
        WHERE di2.idproduto IN (SELECT idproduto FROM my_products)
          AND di2.idpessoa != $1 AND d2.tpoperacao = 'V'
          AND (d2.stdocumentocancelado IS NULL OR d2.stdocumentocancelado != 'S')
          AND d2.dtemissao > NOW() - INTERVAL '12 months'
        LIMIT 50
      )
      SELECT pr.idproduto, pr.cdchamada, pr.nmproduto, g.nmgrupo,
             COUNT(DISTINCT di.idpessoa) AS clientes_similares,
             SUM(di.qtitem) AS qtd_vendida,
             COALESCE(mg.weight, 0) as group_affinity
      FROM wshop.docitem di
      JOIN wshop.produto pr ON pr.idproduto = di.idproduto
      LEFT JOIN wshop.grupo g ON g.idgrupo = pr.idgrupo
      JOIN wshop.documen d ON d.iddocumento = di.iddocumento
      LEFT JOIN my_groups mg ON mg.idgrupo = pr.idgrupo
      WHERE di.idpessoa IN (SELECT idpessoa FROM similar_customers)
        AND di.idproduto NOT IN (SELECT idproduto FROM my_products)
        AND d.tpoperacao = 'V'
        AND (d.stdocumentocancelado IS NULL OR d.stdocumentocancelado != 'S')
        AND d.dtemissao > NOW() - INTERVAL '12 months'
      GROUP BY pr.idproduto, pr.cdchamada, pr.nmproduto, g.nmgrupo, mg.weight
      ORDER BY group_affinity DESC, clientes_similares DESC, qtd_vendida DESC
      LIMIT 10
  `;

  try {
    const res = await pool.query(sql, [idpessoa]);
    console.log(res.rows.map(r => r['QUERY PLAN']).join('\n'));
  } catch (e) {
    console.error(e.message);
  } finally {
    process.exit(0);
  }
}

checkPlan();