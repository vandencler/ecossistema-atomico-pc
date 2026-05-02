
const cwd = process.cwd();
if (!cwd.toLowerCase().includes('-pc')) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error('This script MUST be executed from D:\projetos\ecossistema-atomico-pc');
    process.exit(1);
}

const { pool } = require('../src/main/db');

async function checkActivity() {
  try {
    const res = await pool.query(`
      SELECT pid, state, query, wait_event_type, wait_event, query_start
      FROM pg_stat_activity 
      WHERE state != 'idle' 
        AND query NOT LIKE '%pg_stat_activity%'
    `);
    console.log('Active Queries on Mirror DB:', res.rows);

    const locks = await pool.query(`
      SELECT t.relname, l.locktype, l.mode, l.granted, a.query
      FROM pg_locks l
      JOIN pg_stat_activity a ON l.pid = a.pid
      JOIN pg_class t ON l.relation = t.oid
      WHERE a.datname = 'ALTERDATA_SHOP_ESPELHO'
    `);
    console.log('Locks on Mirror DB:', locks.rows);

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

checkActivity();
