const { ecoPool } = require('../src/main/db');

async function analyzeSidebarFrustration() {
  try {
    const res = await ecoPool.query(`
      SELECT 
        session_id,
        user_id,
        COUNT(*) as toggle_count,
        MIN(occurred_at) as first_toggle,
        MAX(occurred_at) as last_toggle,
        EXTRACT(EPOCH FROM (MAX(occurred_at) - MIN(occurred_at))) as duration_sec
      FROM telemetry_events 
      WHERE event_name = 'IPC_TOGGLESIDEBAR'
      GROUP BY 1, 2
      ORDER BY toggle_count DESC
      LIMIT 20
    `);
    
    console.log('--- Sidebar Frustration Analysis ---');
    console.table(res.rows.map(r => ({
      ...r,
      toggles_per_min: (r.toggle_count / (r.duration_sec / 60 || 1)).toFixed(2)
    })));

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

analyzeSidebarFrustration();
