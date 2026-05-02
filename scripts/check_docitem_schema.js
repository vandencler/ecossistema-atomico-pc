
const cwd = process.cwd();
if (!cwd.toLowerCase().includes("-pc")) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error("This script MUST be executed from D:\projetos\ecossistema-atomico-pc");
    process.exit(1);
}

const { pool } = require('../src/main/db');

async function check() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_schema = 'wshop' 
        AND table_name = 'docitem' 
        AND column_name = 'idpessoa'
    `);
    console.log('Column idpessoa type:', res.rows);

    const idx = await pool.query(`
      SELECT indexdef FROM pg_indexes 
      WHERE schemaname = 'wshop' AND tablename = 'docitem' AND indexname = 'idx_docitem_idpessoa'
    `);
    console.log('Index definition:', idx.rows);
    
    const count = await pool.query(`SELECT count(*) FROM wshop.docitem`);
    console.log('Total rows in docitem:', count.rows[0].count);

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

check();
