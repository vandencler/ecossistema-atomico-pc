const { pool } = require('../src/main/db');

async function checkCandidates() {
  console.log('[AUDIT] Searching for 9th digit candidates...');
  try {
    const res = await pool.query(`
      SELECT idpessoa, campostelwhatsapp, nrtelefone, nrpager 
      FROM wshop.pessoas 
      WHERE 
        (length(regexp_replace(campostelwhatsapp, '[^0-9]', '', 'g')) = 10 AND substring(regexp_replace(campostelwhatsapp, '[^0-9]', '', 'g'), 3, 1) IN ('6','7','8','9'))
        OR (length(regexp_replace(nrtelefone, '[^0-9]', '', 'g')) = 10 AND substring(regexp_replace(nrtelefone, '[^0-9]', '', 'g'), 3, 1) IN ('6','7','8','9'))
        OR (length(regexp_replace(nrpager, '[^0-9]', '', 'g')) = 10 AND substring(regexp_replace(nrpager, '[^0-9]', '', 'g'), 3, 1) IN ('6','7','8','9'))
      LIMIT 10
    `);

    if (res.rowCount === 0) {
      console.log('[AUDIT] No candidates found. All phones seem normalized or landlines.');
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
