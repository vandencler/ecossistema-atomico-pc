
const cwd = process.cwd();
if (!cwd.toLowerCase().includes("-pc")) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error("This script MUST be executed from D:\projetos\ecossistema-atomico-pc");
    process.exit(1);
}

const { pool } = require('../src/main/db');

async function checkIndexes() {
  console.log('--- Mirror DB Index Audit ---');
  try {
    const res = await pool.query(`
      SELECT 
        tablename, 
        indexname, 
        indexdef
      FROM pg_indexes 
      WHERE schemaname = 'wshop' 
        AND tablename IN ('pessoas', 'docitem', 'documen', 'produto')
      ORDER BY tablename, indexname
    `);
    
    if (res.rows.length === 0) {
      console.log('No indexes found or schema not accessible.');
    } else {
      console.table(res.rows.map(r => ({
        Table: r.tablename,
        Index: r.indexname,
        Definition: r.indexdef.substring(0, 50) + '...'
      })));
    }
  } catch (e) {
    console.error('Audit failed:', e.message);
  } finally {
    process.exit(0);
  }
}

checkIndexes();
