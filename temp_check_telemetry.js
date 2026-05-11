const { ecoPool } = require('./src/main/db');

async function checkAppLoads() {
  try {
    const res = await ecoPool.query(`
      SELECT user_id, MIN(occurred_at) as min_date 
      FROM telemetry_events 
      WHERE event_name = 'APP_LOAD' 
      GROUP BY user_id 
      ORDER BY min_date DESC 
      LIMIT 10
    `);
    console.log(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

checkAppLoads();