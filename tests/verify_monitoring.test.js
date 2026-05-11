const monitoringService = require('../src/main/services/monitoringService');

async function testMonitoring() {
  console.log('--- Testing Monitoring Service ---');
  try {
    const snapshot = await monitoringService.takeSnapshot();
    console.log('Snapshot captured successfully:');
    console.log('Status:', snapshot.status);
    console.log('Summary:', snapshot.summary);
    
    const recent = await monitoringService.getRecentSnapshots(1);
    if (recent.length > 0) {
      console.log('Successfully retrieved snapshot from DB.');
    } else {
      throw new Error('Snapshot not found in DB!');
    }
    
    console.log('Test PASSED.');
  } catch (e) {
    console.error('Test FAILED:', e.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

testMonitoring();
