const intel = require('./src/main/services/bulkIntelligenceService');
intel.runSweep().then(res => console.log('Result:', res)).catch(e => console.error('Crash:', e)).finally(() => process.exit(0));