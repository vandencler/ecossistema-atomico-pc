const { pool } = require('../src/main/db');

async function checkCandidates() {
  console.log('[AUDIT] Searching for phones with non-numeric characters...');
  try {
    const res = await pool.query(`
      SELECT idpessoa, campostelwhatsapp, nrtelefone, nrpager 
      FROM wshop.pessoas 
      WHERE 
        campostelwhatsapp ~ '[^0-9]'
        OR nrtelefone ~ '[^0-9]'
        OR nrpager ~ '[^0-9]'
      LIMIT 10
    `);

    if (res.rowCount === 0) {
      console.log('[AUDIT] No phones with non-numeric characters found.');
    } else {
      console.log(`[AUDIT] Found ${res.rowCount} candidates (limit 10):`);
      console.table(res.rows);
    }
  } catch (err) {
    console.error('[AUDIT] Error:', err.message);
  } finally {
    process.exit();
  }
}

checkCandidates();
