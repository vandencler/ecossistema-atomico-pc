const { ecoPool, pool } = require('../src/main/db');
const fs = require('fs');
const path = require('path');

async function monitor() {
  const cwd = process.cwd();
  if (!cwd.toLowerCase().includes('-pc')) {
      console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
      console.error('This monitor MUST be executed from D:\\projetos\\ecossistema-atomico-pc');
      process.exit(1);
  }

  console.log('=== EAV Pilot Technical Monitoring Command Center ===');
  console.log('Data:', new Date().toLocaleString());
  console.log('Workspace:', cwd);
  console.log('----------------------------------------------------');

  try {
    // 1. DB Connectivity
    const mirrorOk = await pool.query('SELECT 1').then(() => true).catch(() => false);
    const ecoOk = await ecoPool.query('SELECT 1').then(() => true).catch(() => false);
    console.log(`[DB] Mirror Database (Alterdata):    ${mirrorOk ? '?? OK' : '?? ERROR'}`);
    console.log(`[DB] Ecosystem Database (Local):     ${ecoOk ? '?? OK' : '?? ERROR'}`);

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
      console.log('Nenhum erro critico detectado. ?');
    } else {
      errorRes.rows.forEach(r => {
        let alert = '';
        if (r.tipo === 'SAV_UNDO_ERROR' || r.tipo === 'SYNC_ERROR') alert = ' ?? (Param Mismatch Fix Applied)';
        console.log(`- ${r.tipo.padEnd(20)}: ${String(r.count).padStart(3)}${alert} (Ultimo: ${new Date(r.last_seen).toLocaleTimeString()})`);
      });
    }

    // 3. Performance & Sync Latency
    console.log('\n[?] Performance & Latencia de Sync (48h):');
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
    console.log(`- Slow Queries (1h):   ${slowRes.rows[0].count} (Target: EAV-94)`);

    // 4b. EAV-94 Specific Blockers
    console.log('\n[!] Blockers de Escala (EAV-94):');
    const eav94Tables = ['docitem', 'documen', 'produto', 'tabelaprecos'];
    let permissionCount = 0;
    for (const table of eav94Tables) {
      const ok = await pool.query(`SELECT 1 FROM wshop.${table} LIMIT 1`).then(() => true).catch(() => false);
      if (!ok) permissionCount++;
    }
    console.log(`- Tabelas bloqueadas:  ${permissionCount}/${eav94Tables.length} ${permissionCount > 0 ? '??' : '??'}`);

    const docItemIdxRaw = await pool.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'wshop' AND tablename = 'docitem' AND indexname = 'idx_docitem_idpessoa'
    `).catch(e => { console.log('DEBUG: Index check error:', e.message); return { rowCount: 0 }; });
    const docItemIdx = docItemIdxRaw.rowCount > 0;
    console.log(`- Index docitem_idp:   ${docItemIdx ? '?? OK' : '?? MISSING (Slow Dashboard)'}`);

    // 5. Sentiment Pulse (Phase 6)
    console.log('\n[??] Pulso de Sentimento (Base Piloto):');
    const sentiment = await ecoPool.query(`
      SELECT sentiment_label, COUNT(*) as count, AVG(sentiment_score) as avg_score
      FROM ml_client_sentiment GROUP BY 1
    `);
    const totalSent = sentiment.rows.reduce((a, b) => a + parseInt(b.count), 0);
    sentiment.rows.forEach(r => {
      const pct = ((r.count / totalSent) * 100).toFixed(1);
      const icon = r.sentiment_label === 'POSITIVE' ? '??' : (r.sentiment_label === 'NEGATIVE' ? '??' : '?');
      console.log(`- ${icon} ${r.sentiment_label.padEnd(10)}: ${r.count} (${pct}%) | Score: ${parseFloat(r.avg_score).toFixed(2)}`);
    });

    // 6. ML & Intelligence Freshness
    console.log('\n[??] Saude da Inteligencia (Freshness):');
    const driftRes = await ecoPool.query('SELECT MAX(calculado_em) as last_calc FROM ml_churn_risk');
    const dbAge = driftRes.rows[0].last_calc ? (new Date() - driftRes.rows[0].last_calc) / (1000 * 60 * 60) : 999;

    const churnFile = path.join(cwd, 'ml_data', 'ml_churn_training.csv');
    const csvAge = fs.existsSync(churnFile) ? (new Date() - fs.statSync(churnFile).mtime) / (1000 * 60 * 60) : 999;

    console.log(`- Inference (DB):      ${dbAge.toFixed(1)}h de idade ${dbAge > 24 ? '??' : '??'}`);
    console.log(`- Extraction (CSV):   ${csvAge.toFixed(1)}h de idade ${csvAge > 2 ? '?? (Stalled)' : '??'}`);

    console.log('\n----------------------------------------------------');
    console.log('Monitoramento concluido.');

  } catch (e) {
    console.error('Falha ao executar monitoramento:', e.message);
  } finally {
    process.exit(0);
  }
}

monitor();
