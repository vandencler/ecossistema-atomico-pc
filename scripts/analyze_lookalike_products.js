const { pool, ecoPool } = require('../src/main/db');

async function analyzeLookalikeProducts() {
  try {
    const vipRes = await ecoPool.query("SELECT idpessoa FROM ranking_cache WHERE abc = 'A'");
    const vipIds = vipRes.rows.map(r => r.idpessoa);

    const res = await pool.query(`
      SELECT di.idproduto, pr.nmproduto, COUNT(DISTINCT di.idpessoa) as client_count
      FROM wshop.docitem di
      JOIN wshop.produto pr ON pr.idproduto = di.idproduto
      WHERE di.idpessoa = ANY($1::varchar[])
      GROUP BY 1, 2
      ORDER BY 3 DESC
      LIMIT 10
    `, [vipIds]);
    
    console.log('Top Products for Sorocaba VIPs:');
    console.table(res.rows);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

analyzeLookalikeProducts();
