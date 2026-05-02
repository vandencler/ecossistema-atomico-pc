const { pool } = require('../src/main/db');

async function verify() {
  console.log('--- EAV-94 Verification ---');
  
  try {
    // 1. Check max_connections
    const maxConnRes = await pool.query('SHOW max_connections');
    const maxConn = parseInt(maxConnRes.rows[0].max_connections, 10);
    console.log(`max_connections: ${maxConn} (Target: 250)`);

    // 2. Check docitem indexes
    const indexCheck = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE (schemaname = 'wshop' OR schemaname = 'public')
        AND tablename = 'docitem' 
        AND indexname IN ('idx_docitem_idpessoa', 'idx_docitem_idproduto')
    `);
    const foundIndexes = indexCheck.rows.map(r => r.indexname);
    console.log(`Found docitem indexes: ${foundIndexes.join(', ') || 'NONE'}`);

    // 3. Check table accessibility and permissions
    const tables = [
        'pessoas', 'crediar', 'docitem', 'documen', 'produto', 
        'tabelaprecos', 'pessoas_endereco', 'documento_nfce', 
        'movcaix', 'tprec', 'grupo', 'ranking_calculadoloja'
    ];
    
    console.log('\n--- Table Permissions Check (SELECT) ---');
    for (const table of tables) {
      try {
        await pool.query(`SELECT 1 FROM wshop.${table} LIMIT 1`);
        console.log(`[OK] wshop.${table}`);
      } catch (err) {
        console.log(`[FAIL] wshop.${table}: ${err.message}`);
      }
    }

    // 4. Check UPDATE permission on sync targets
    console.log('\n--- Sync Targets (UPDATE) ---');
    const syncTargets = [
      { table: 'pessoas', col: 'cdchamada' },
      { table: 'crediar', col: 'idpessoa' } // idpessoa should exist in crediar
    ];
    for (const target of syncTargets) {
      try {
        await pool.query('BEGIN');
        await pool.query(`UPDATE wshop.${target.table} SET ${target.col} = ${target.col} WHERE 1=0`);
        await pool.query('ROLLBACK');
        console.log(`[OK] UPDATE on wshop.${target.table}`);
      } catch (err) {
        await pool.query('ROLLBACK').catch(() => {});
        console.log(`[FAIL] UPDATE on wshop.${target.table}: ${err.message}`);
      }
    }

    // 5. Check CREATE INDEX permission (Dry run)
    console.log('\n--- CREATE INDEX Permission Check ---');
    try {
      await pool.query('BEGIN');
      await pool.query('CREATE INDEX test_idx_temp ON wshop.docitem (idproduto)');
      await pool.query('ROLLBACK');
      console.log('[OK] Application user HAS permission to CREATE INDEX.');
    } catch (err) {
      await pool.query('ROLLBACK').catch(() => {});
      console.log(`[FAIL] CREATE INDEX permission: ${err.message}`);
    }

  } catch (err) {
    console.error('Verification failed:', err.message);
  } finally {
    process.exit(0);
  }
}

verify();
