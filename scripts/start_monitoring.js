const monitoringService = require('../src/main/services/monitoringService');

console.log('[RECOVERY] Starting Monitoring Service loop...');
monitoringService.start(5 * 60 * 1000); // 5 minutes

// Keep process alive
setInterval(() => {
  console.log(`[RECOVERY] Monitoring heartbeat: ${new Date().toISOString()}`);
}, 60000);
