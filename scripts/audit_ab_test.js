const { ecoPool } = require('../src/main/db');

async function auditABTest() {
  console.log('=== EAV A/B TESTING CONVERSION AUDIT ===\n');
  
  try {
    // 1. Get Population Counts
    const popRes = await ecoPool.query(`
      SELECT payload->>'group' as ab_group, count(DISTINCT user_id) as client_count
      FROM telemetry_events
      WHERE event_name = 'intel_score_calculated'
      GROUP BY 1
    `);
    
    const populations = {};
    popRes.rows.forEach(r => populations[r.ab_group] = parseInt(r.client_count));

    // 2. Get Conversion Counts (Successful SAV Actions)
    const convRes = await ecoPool.query(`
      SELECT t.ab_group, count(DISTINCT a.idpessoa) as conv_count
      FROM acoes_pendentes a
      JOIN (
        SELECT DISTINCT user_id as idpessoa, payload->>'group' as ab_group
        FROM telemetry_events
        WHERE event_name = 'intel_score_calculated'
      ) t ON a.idpessoa = t.idpessoa
      WHERE a.status = 'CONCLUIDO'
      GROUP BY 1
    `);

    const conversions = {};
    convRes.rows.forEach(r => conversions[r.ab_group] = parseInt(r.conv_count));

    console.log('Group | Population | Conversions | Conversion Rate');
    console.log('------|------------|-------------|----------------');

    ['A', 'B'].forEach(group => {
      const pop = populations[group] || 0;
      const conv = conversions[group] || 0;
      const rate = pop > 0 ? ((conv / pop) * 100).toFixed(2) : '0.00';
      console.log(`${group.padEnd(5)} | ${pop.toString().padEnd(10)} | ${conv.toString().padEnd(11)} | ${rate}%`);
    });

    console.log('\n* Conversion defined as at least one COMPLETED SAV action for the client.');

  } catch (err) {
    console.error('Audit Error:', err.message);
  } finally {
    process.exit(0);
  }
}

auditABTest();
