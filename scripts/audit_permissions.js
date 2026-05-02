const { pool } = require('../src/main/db');

async function checkPermissions() {
  const tables = [
    'wshop.pessoas',
    'wshop.crediar',
    'wshop.documen',
    'wshop.docitem',
    'wshop.produto',
    'wshop.tabelaprecos',
    'wshop.ranking_calculadoloja',
    'wshop.pessoas_endereco',
    'wshop.movimento_venda'
  ];

  console.log('=== Permission Audit (192.168.2.163) ===');
  for (const table of tables) {
    try {
      await pool.query(`SELECT 1 FROM ${table} LIMIT 1`);
      console.log(`${table.padEnd(30)}: 🟢 OK`);
    } catch (e) {
      console.log(`${table.padEnd(30)}: 🔴 BLOCKED (${e.message})`);
    }
  }
  process.exit(0);
}

checkPermissions();
