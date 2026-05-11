const monitoringService = require('../src/main/services/monitoringService');

async function run() {
  console.log('=== EAV 24/7 Monitoring Status Check ===');
  try {
    const snapshots = await monitoringService.getRecentSnapshots(5);
    if (snapshots.length === 0) {
      console.log('No snapshots found. Running fresh check...');
      const fresh = await monitoringService.takeSnapshot();
      console.log('Current Status:', fresh.status);
      console.log('Summary:', fresh.summary);
    } else {
      console.log('Recent Snapshots (Last 5):');
      snapshots.forEach(s => {
        console.log(`[${new Date(s.snapshot_time).toLocaleString()}] ${s.status.padEnd(10)} | ${s.summary}`);
      });
    }
  } catch (e) {
    console.error('Failed to check monitoring status:', e.message);
  } finally {
    process.exit(0);
  }
}

run();
