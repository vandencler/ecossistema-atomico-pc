
const cwd = process.cwd();
if (!cwd.toLowerCase().includes("-pc")) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error("This script MUST be executed from D:\projetos\ecossistema-atomico-pc");
    process.exit(1);
}

const { pool } = require('../src/main/db');

async function check() {
  try {
    const res = await pool.query("SHOW max_connections");
    const current = res.rows[0].max_connections;
    
    const settings = await pool.query("SELECT name, setting, unit, pending_restart FROM pg_settings WHERE name = 'max_connections'");
    const s = settings.rows[0];

    console.log(`=== Infrastructure Audit (Mirror DB) ===`);
    console.log(`Current max_connections: ${current}`);
    console.log(`Setting in pg_settings:  ${s.setting}`);
    console.log(`Pending Restart:         ${s.pending_restart}`);
    
    if (s.pending_restart === 't' || s.pending_restart === true) {
        console.log(`\n[ALERT] A restart is REQUIRED to apply the new limit.`);
    } else {
        console.log(`\n[INFO] No restart pending for max_connections.`);
    }

  } catch (e) {
    console.error('Failed to check connections:', e.message);
  } finally {
    process.exit(0);
  }
}

check();
