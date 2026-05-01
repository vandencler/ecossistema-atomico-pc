const { pool } = require('../src/main/db');

async function main() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'wshop' AND table_name = 'pessoas'
      AND column_name IN ('nmpessoa', 'nmcurto', 'cdchamada', 'nrcgc_cic', 'campostelwhatsapp', 'nrtelefone')
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e.message);
  } finally {
    process.exit(0);
  }
}

main();