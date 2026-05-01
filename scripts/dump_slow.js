const { ecoPool } = require('../src/main/db');

async function test() {
  try {
    const res = await ecoPool.query("SELECT payload FROM telemetry_events WHERE event_name = 'SLOW_QUERY' ORDER BY occurred_at DESC LIMIT 5");
    res.rows.forEach(r => {
        console.log('--- SLOW QUERY ---');
        console.log(r.payload);
    });
  } catch (e) {
    console.error(e);
  } finally {
    await ecoPool.end();
  }
}
test();
