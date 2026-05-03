
const cwd = process.cwd();
if (!cwd.toLowerCase().includes("-pc")) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error("This script MUST be executed from D:\projetos\ecossistema-atomico-pc");
    process.exit(1);
}

const { ecoPool } = require('../src/main/db');

async function auditOwnership() {
  try {
    const res = await ecoPool.query(`
      SELECT 
        tablename, 
        tableowner 
      FROM 
        pg_tables 
      WHERE 
        schemaname = 'public';
    `);
    console.log('Table Ownership Audit:', JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

auditOwnership();
