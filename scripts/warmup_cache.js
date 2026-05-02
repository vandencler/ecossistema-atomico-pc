
const cwd = process.cwd();
if (!cwd.toLowerCase().includes("-pc")) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error("This script MUST be executed from D:\projetos\ecossistema-atomico-pc");
    process.exit(1);
}


const path = require('path');
const { initLocalDb } = require('../src/main/localDb');
const { warmUpCache } = require('../src/main/services/cacheService');

async function run() {
  console.log('=== EAV Cache Warm-up Utility (EAV-130) ===');
  
  // Use a local folder for the SQLite DB when running as a script
  const dbPath = path.join(process.cwd(), 'temp_data');
  if (!require('fs').existsSync(dbPath)) {
    require('fs').mkdirSync(dbPath);
  }

  try {
    initLocalDb(dbPath);
    console.log(`[WARMUP] Local DB initialized at: ${dbPath}`);

    await warmUpCache();
    
    console.log('[WARMUP] Success: Cache is now populated.');
    process.exit(0);
  } catch (e) {
    console.error('[WARMUP] Failed:', e.message);
    process.exit(1);
  }
}

run();
