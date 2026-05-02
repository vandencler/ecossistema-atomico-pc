
const cwd = process.cwd();
if (!cwd.toLowerCase().includes('-pc')) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error('This script MUST be executed from D:\projetos\ecossistema-atomico-pc');
    process.exit(1);
}

const bulkIntel = require('../src/main/services/bulkIntelligenceService');
const { initLocalDb } = require('../src/main/localDb');
const path = require('path');
const fs = require('fs');

async function run() {
  console.log('--- Starting Production Bulk Intelligence Sweep ---');
  
  // Ensure local DB is initialized for telemetry tracking during sweep
  const dbDir = path.join(process.cwd(), 'temp_data');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  initLocalDb(dbDir);

  const result = await bulkIntel.runSweep();
  console.log('Sweep Result:', result);
  
  const telemetry = require('../src/main/services/telemetryService');
  console.log('Flushing telemetry...');
  await telemetry.flushTelemetry();

  console.log('--- Sweep Complete ---');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error in sweep:', err);
  process.exit(1);
});
