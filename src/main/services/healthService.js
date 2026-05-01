const { pool, ecoPool } = require('../db');
const { logError, logEvent } = require('./logService');

let lastHealth = null;

async function checkHealth() {
  const health = {
    timestamp: new Date().toISOString(),
    status: 'HEALTHY',
    databases: {
      mirror: { status: 'UNKNOWN' },
      ecosystem: { status: 'UNKNOWN' }
    }
  };

  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    
    // Check for Trigram Indexes durability on multiple high-traffic fields
    // We check explicitly for the 'wshop' schema as it's the standard for Alterdata Mirror
    const indexCheck = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE (schemaname = 'wshop' OR schemaname = 'public')
        AND tablename = 'pessoas' 
        AND indexname IN (
          'idx_pessoas_nmpessoa_trgm', 
          'idx_pessoas_nmcurto_trgm', 
          'idx_pessoas_cdchamada_trgm', 
          'idx_pessoas_nrcgc_cic_trgm',
          'idx_pessoas_phones_trgm',
          'idx_pessoas_telwa_trgm',
          'idx_pessoas_phone_trgm'
        )
    `);
    const foundIndexes = indexCheck.rows.map(r => r.indexname);
    // These specific trigram indexes are expected for high-performance searches
    const requiredIndexes = [
      'idx_pessoas_nmpessoa_trgm', 
      'idx_pessoas_nmcurto_trgm', 
      'idx_pessoas_cdchamada_trgm', 
      'idx_pessoas_nrcgc_cic_trgm',
      'idx_pessoas_phones_trgm' // Legacy fallback
    ];

    // Phone optimization is satisfied if either the legacy combined index or BOTH new split indexes are present
    const phonesOptimized = foundIndexes.includes('idx_pessoas_phones_trgm') || 
                           (foundIndexes.includes('idx_pessoas_telwa_trgm') && foundIndexes.includes('idx_pessoas_phone_trgm'));

    const optimized = requiredIndexes.filter(idx => idx !== 'idx_pessoas_phones_trgm')
                                    .every(idx => foundIndexes.includes(idx)) && phonesOptimized;

    health.databases.mirror = { 
      status: foundIndexes.length > 0 ? 'OK' : 'OK_BUT_UNOPTIMIZED', 
      latencyMs: Date.now() - start,
      indexesOptimized: optimized,
      indexMap: {
        ...requiredIndexes.reduce((map, idx) => {
          map[idx] = foundIndexes.includes(idx);
          return map;
        }, {}),
        'idx_pessoas_telwa_trgm': foundIndexes.includes('idx_pessoas_telwa_trgm'),
        'idx_pessoas_phone_trgm': foundIndexes.includes('idx_pessoas_phone_trgm')
      },
      foundIndexes,
      missingIndexes: [
        ...requiredIndexes.filter(idx => idx !== 'idx_pessoas_phones_trgm' && !foundIndexes.includes(idx)),
        ...(!phonesOptimized ? ['idx_pessoas_telwa_trgm', 'idx_pessoas_phone_trgm'] : [])
      ]
    };

    if (!optimized) {
      console.warn(`[HEALTH] Mirror indexes missing: ${health.databases.mirror.missingIndexes.join(', ')}`);
    }
  } catch (e) {
    health.status = 'DEGRADED';
    health.databases.mirror = { status: 'ERROR', error: e.message };
    await logError('HEALTH_MIRROR', e);
  }

  try {
    const start = Date.now();
    await ecoPool.query('SELECT 1');
    
    // Check local SQLite cache status
    const { getLocalDb } = require('../localDb');
    let cacheCount = 0;
    try {
      const db = getLocalDb();
      const row = db.prepare('SELECT COUNT(*) as count FROM client_cache').get();
      cacheCount = row.count;
    } catch (sqliteErr) {
      console.error('[HEALTH] Falha ao ler cache SQLite:', sqliteErr.message);
    }

    health.databases.ecosystem = { 
      status: 'OK', 
      latencyMs: Date.now() - start,
      cacheRows: cacheCount
    };

    // Telemetry and Sync Diagnostics
    try {
      const telCount = await ecoPool.query('SELECT COUNT(*) as count FROM telemetry_events');
      const db = getLocalDb();
      const telBuffer = db.prepare('SELECT COUNT(*) as count FROM telemetry_buffer').get();

      // NEW: Telemetry trends (last 24h)
      const telRecent = await ecoPool.query(`
        SELECT count(*) as count 
        FROM telemetry_events 
        WHERE occurred_at > NOW() - INTERVAL '24 hours'
      `);

      // NEW: Sync Latency (Average time between Approval and Execution for the last 50 items)
      const syncLatency = await ecoPool.query(`
        SELECT 
          AVG(EXTRACT(EPOCH FROM (executado_em - aprovado_em))) as avg_latency_seconds,
          COUNT(*) as items_count
        FROM acoes_pendentes
        WHERE status = 'CONCLUIDO' 
          AND aprovado_em IS NOT NULL 
          AND executado_em IS NOT NULL
          AND executado_em > NOW() - INTERVAL '7 days'
      `);

      health.telemetry = {
        totalEvents: parseInt(telCount.rows[0].count, 10),
        bufferedEvents: telBuffer.count,
        recentEvents24h: parseInt(telRecent.rows[0].count, 10),
        lastFlush: new Date().toISOString()
      };

      health.syncMetrics = {
        avgLatencySeconds: Math.round(syncLatency.rows[0].avg_latency_seconds || 0),
        processedCount: parseInt(syncLatency.rows[0].items_count, 10)
      };
    } catch (telErr) {
      console.error('[HEALTH] Falha ao ler métricas avançadas:', telErr.message);
    }
  } catch (e) {
    health.status = 'DEGRADED';
    health.databases.ecosystem = { status: 'ERROR', error: e.message };
    await logError('HEALTH_ECOSYSTEM', e);
  }

  if (health.status !== 'HEALTHY') {
    await logEvent('SYSTEM_HEALTH', '0', `Estado do sistema: ${health.status}. Detalhes: ${JSON.stringify(health.databases)}`);
  }

  lastHealth = health;
  return health;
}

/**
 * Returns the last health check result or performs one if none exists.
 */
async function getLastHealth() {
  if (!lastHealth) return await checkHealth();
  return lastHealth;
}

/**
 * Returns true if the mirror database is optimized with required trigram indexes.
 */
async function isSearchOptimized() {
  const health = await getLastHealth();
  return !!health.databases.mirror?.indexesOptimized;
}

/**
 * Returns a mapping of which trigram indexes are available.
 */
async function getIndexMap() {
  const health = await getLastHealth();
  return health.databases.mirror?.indexMap || {};
}

/**
 * Returns true if the remote databases are unreachable.
 */
async function isOfflineMode() {
  try {
    await pool.query('SELECT 1');
    await ecoPool.query('SELECT 1');
    return false;
  } catch {
    return true;
  }
}

module.exports = { checkHealth, isOfflineMode, getLastHealth, isSearchOptimized, getIndexMap };
