const { pool } = require('../src/main/db');

async function auditPermissions() {
  const tables = [
    'wshop.pessoas',
    'wshop.crediar',
    'wshop.documen',
    'wshop.docitem',
    'wshop.produto',
    'wshop.categoria',
    'wshop.familia',
    'wshop.grupo',
    'wshop.marca',
    'wshop.tabelaprecos',
    'wshop.documento_nfce',
    'wshop.movcaix',
    'wshop.tprec'
  ];

  console.log('--- Database Permission Audit (Mirror DB) ---');
  for (const table of tables) {
    try {
      await pool.query(`SELECT 1 FROM ${table} LIMIT 1`);
      console.log(`[OK]   ${table.padEnd(25)} : ACCESSIBLE`);
    } catch (e) {
      console.log(`[FAIL] ${table.padEnd(25)} : ${e.message}`);
    }
  }
  process.exit(0);
}

auditPermissions();
