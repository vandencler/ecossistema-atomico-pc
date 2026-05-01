const { ecoPool, pool } = require('../src/main/db');

async function monitor() {
  console.log('=== EAV Pilot Technical Monitoring Command Center ===');
  console.log('Data:', new Date().toLocaleString());
  console.log('----------------------------------------------------');

  try {
    // 1. DB Connectivity
    const mirrorOk = await pool.query('SELECT 1').then(() => true).catch(() => false);
    const ecoOk = await ecoPool.query('SELECT 1').then(() => true).catch(() => false);
    console.log(`[DB] Mirror Database (Alterdata):    ${mirrorOk ? '🟢 OK' : '🔴 ERROR'}`);
    console.log(`[DB] Ecosystem Database (Local):     ${ecoOk ? '🟢 OK' : '🔴 ERROR'}`);

    // 2. Critical Errors (Last 24h)
    console.log('\n[!] Erros Criticos (Ultimas 24h):');
    const errorRes = await ecoPool.query(`
      SELECT tipo, COUNT(*) as count, MAX(criado_em) as last_seen
      FROM log_eventos
      WHERE (tipo LIKE '%_ERROR' OR tipo LIKE '%_FAIL')
        AND criado_em > NOW() - INTERVAL '24 hours'
      GROUP BY tipo
      ORDER BY count DESC
    `);

    if (errorRes.rowCount === 0) {
      console.log('Nenhum erro critico detectado. ✅');
    } else {
      errorRes.rows.forEach(r => {
        let alert = '';
        if (r.tipo === 'SAV_UNDO_ERROR' || r.tipo === 'SYNC_ERROR') alert = ' ⚠️ (Param Mismatch Fix Applied)';
        console.log(`- ${r.tipo}: ${r.count}${alert} (Ultimo: ${new Date(r.last_seen).toLocaleTimeString()})`);
      });
    }

    // 3. Performance & Sync Latency
    console.log('\n[⚡] Performance & Latencia de Sync (48h):');
    const latencyRes = await ecoPool.query(`
      SELECT 
        AVG(EXTRACT(EPOCH FROM (executado_em - aprovado_em))) as avg_latency_sec,
        MAX(EXTRACT(EPOCH FROM (executado_em - aprovado_em))) as max_latency_sec,
        COUNT(*) as items
      FROM acoes_pendentes
      WHERE status = 'CONCLUIDO' 
        AND aprovado_em IS NOT NULL 
        AND executado_em IS NOT NULL
        AND executado_em > NOW() - INTERVAL '48 hours'
    `);

    const lat = latencyRes.rows[0];
    if (parseInt(lat.items) === 0) {
      console.log('Nenhum item sincronizado no periodo.');
    } else {
      console.log(`- Itens Sincronizados: ${lat.items}`);
      console.log(`- Latencia Media:      ${Math.round(lat.avg_latency_sec)}s`);
      console.log(`- Latencia Maxima:     ${Math.round(lat.max_latency_sec)}s`);
    }

    // 4. Slow Queries (Telemetry)
    const slowRes = await ecoPool.query(`
      SELECT COUNT(*) as count
      FROM telemetry_events
      WHERE event_name = 'SLOW_QUERY'
        AND occurred_at > NOW() - INTERVAL '1 hour'
    `);
    console.log(`- Slow Queries (1h):   ${slowRes.rows[0].count} (Target: EAV-101)`);

    // 5. ML & Intelligence
    console.log('\n[🧠] Inteligência & ML Coverage:');
    const churnCount = await ecoPool.query('SELECT COUNT(*) FROM ml_churn_risk');
    const affinityCount = await ecoPool.query('SELECT COUNT(*) FROM ml_product_affinity');
    console.log(`- Churn Risk Model:    ${churnCount.rows[0].count} scores active`);
    console.log(`- Product Affinity:    ${affinityCount.rows[0].count} relations active`);

    console.log('\n----------------------------------------------------');
    console.log('Monitoramento concluido.');

  } catch (e) {
    console.error('Falha ao executar monitoramento:', e.message);
  } finally {
    process.exit(0);
  }
}

monitor();