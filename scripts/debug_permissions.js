
const cwd = process.cwd();
if (!cwd.toLowerCase().includes("-pc")) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error("This script MUST be executed from D:\projetos\ecossistema-atomico-pc");
    process.exit(1);
}

const { ecoPool } = require('../src/main/db');

async function checkPermissions() {
  try {
    const res = await ecoPool.query(`
      SELECT 
        tablename, 
        tableowner 
      FROM 
        pg_tables 
      WHERE 
        tablename = 'ranking_cache';
    `);
    console.log('Ownership:', res.rows);

    const permRes = await ecoPool.query(`
      SELECT 
        grantee, 
        privilege_type 
      FROM 
        information_schema.role_table_grants 
      WHERE 
        table_name = 'ranking_cache';
    `);
    console.log('Permissions:', permRes.rows);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

checkPermissions();
