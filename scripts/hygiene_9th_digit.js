const { pool } = require('../src/main/db');
const purgeService = require('../src/main/services/purgeService');

async function runHygiene() {
  console.log('[HYGIENE] Starting 9th digit normalization audit...');
  try {
    // 1. Identify candidates in Mirror DB
    const res = await pool.query(`
      SELECT idpessoa, campostelwhatsapp, nrtelefone, nrpager 
      FROM wshop.pessoas 
      WHERE 
        -- Needs 9th digit
        (length(regexp_replace(campostelwhatsapp, '[^0-9]', '', 'g')) = 10 AND substring(regexp_replace(campostelwhatsapp, '[^0-9]', '', 'g'), 3, 1) IN ('6','7','8','9'))
        OR (length(regexp_replace(nrtelefone, '[^0-9]', '', 'g')) = 10 AND substring(regexp_replace(nrtelefone, '[^0-9]', '', 'g'), 3, 1) IN ('6','7','8','9'))
        OR (length(regexp_replace(nrpager, '[^0-9]', '', 'g')) = 10 AND substring(regexp_replace(nrpager, '[^0-9]', '', 'g'), 3, 1) IN ('6','7','8','9'))
        -- OR has non-numeric characters
        OR campostelwhatsapp ~ '[^0-9]'
        OR nrtelefone ~ '[^0-9]'
        OR nrpager ~ '[^0-9]'
    `);

    console.log(`[HYGIENE] Found ${res.rowCount} candidates for normalization.`);

    for (const row of res.rows) {
      console.log(`[HYGIENE] Processing ID ${row.idpessoa}...`);
      const result = await purgeService.normalize9thDigit(row.idpessoa, row);
      if (result.ok) {
        if (result.skipped) {
          // console.log(`[HYGIENE] ID ${row.idpessoa} already normalized or invalid.`);
        } else {
          console.log(`[HYGIENE] ID ${row.idpessoa} normalized and queued for ERP write-back (Queue ID: ${result.queueId}).`);
        }
      } else {
        console.error(`[HYGIENE] Failed to normalize ID ${row.idpessoa}: ${result.error}`);
      }
    }

    console.log('[HYGIENE] Normalization audit complete.');
  } catch (err) {
    console.error('[HYGIENE] Critical error:', err.message);
  } finally {
    process.exit();
  }
}

runHygiene();
