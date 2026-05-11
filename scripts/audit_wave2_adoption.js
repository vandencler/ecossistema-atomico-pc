const { ecoPool } = require('../src/main/db');

async function audit() {
  console.log('=== RELATÓRIO DE ADOÇÃO WAVE 2 ===');
  
  try {
    // 1. Version distribution
    const versions = await ecoPool.query(`
      SELECT 
        payload->>'version' as version, 
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) as total_events
      FROM telemetry_events
      WHERE occurred_at > NOW() - INTERVAL '4 hours'
      GROUP BY 1
      ORDER BY 2 DESC
    `);
    
    console.log('\n--- Distribuição de Versões (Últimas 4h) ---');
    console.table(versions.rows);

    // 2. Success/Failure of Proxy Connection
    // We look for any event that came through the proxy (system user usually logs them or we can check user_id)
    const connectivity = await ecoPool.query(`
      SELECT 
        event_name, 
        COUNT(*) as count
      FROM telemetry_events
      WHERE occurred_at > NOW() - INTERVAL '1 hour'
      GROUP BY 1
      ORDER BY 2 DESC
    `);
    console.log('\n--- Atividade Recente (Última 1h) ---');
    console.table(connectivity.rows);

    // 3. Identification of potential blockers (errors)
    const errors = await ecoPool.query(`
      SELECT 
        payload->>'error' as error_msg,
        COUNT(*) as count
      FROM telemetry_events
      WHERE event_name = 'SEARCH_ERROR' OR event_name = 'SYNC_ERROR'
      AND occurred_at > NOW() - INTERVAL '4 hours'
      GROUP BY 1
      LIMIT 5
    `);
    console.log('\n--- Erros Recentes (Potenciais Bloqueadores) ---');
    console.table(errors.rows);

  } catch (e) {
    console.error('Falha no audit:', e.message);
  } finally {
    process.exit(0);
  }
}

audit();
