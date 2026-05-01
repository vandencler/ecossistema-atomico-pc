const bulkIntel = require('./src/main/services/bulkIntelligenceService');

bulkIntel.runSweep()
  .then(res => {
    console.log('Result:', res);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
