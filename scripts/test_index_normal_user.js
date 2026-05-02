
const cwd = process.cwd();
if (!cwd.toLowerCase().includes('-pc')) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error('This script MUST be executed from D:\projetos\ecossistema-atomico-pc');
    process.exit(1);
}

const { pool } = require('../src/main/db');

async function findAndExplain() {
  try {
    const ids = await pool.query(`
      SELECT idpessoa, COUNT(*) as count 
      FROM wshop.docitem 
      GROUP BY idpessoa 
      ORDER BY count ASC 
      LIMIT 5
    `);
    
    if (ids.rows.length === 0) {
      console.log('No clients found in docitem.');
      return;
    }

    for (const row of ids.rows) {
      const id = row.idpessoa;
      console.log(`\n--- Testing for idpessoa: ${id} (${row.count} items) ---`);
      const query = `
        EXPLAIN (ANALYZE)
        SELECT * FROM wshop.docitem di
        WHERE di.idpessoa = $1
      `;
      const res = await pool.query(query, [id]);
      res.rows.forEach(r => console.log(r['QUERY PLAN']));
    }

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

findAndExplain();
