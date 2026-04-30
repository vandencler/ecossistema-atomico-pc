const { pool, ecoPool } = require('../db');
const { logError, logEvent } = require('./logService');

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
    const indexCheck = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'pessoas' 
        AND indexname IN ('idx_pessoas_nmpessoa_trgm', 'idx_pessoas_nmcurto_trgm', 'idx_pessoas_cdchamada_trgm')
    `);
    const foundIndexes = indexCheck.rows.map(r => r.indexname);
    // These specific trigram indexes are expected for high-performance searches
    const requiredIndexes = ['idx_pessoas_nmpessoa_trgm', 'idx_pessoas_nmcurto_trgm'];
    const optimized = requiredIndexes.length > 0 && requiredIndexes.every(idx => foundIndexes.includes(idx));

    health.databases.mirror = { 
      status: foundIndexes.length > 0 ? 'OK' : 'OK_BUT_UNOPTIMIZED', 
      latencyMs: Date.now() - start,
      indexesOptimized: optimized,
      foundIndexes,
      missingIndexes: requiredIndexes.filter(idx => !foundIndexes.includes(idx))
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

    // Telemetry Diagnostics
    try {
      const telCount = await ecoPool.query('SELECT COUNT(*) as count FROM telemetry_events');
      const db = getLocalDb();
      const telBuffer = db.prepare('SELECT COUNT(*) as count FROM telemetry_buffer').get();

      health.telemetry = {
        totalEvents: parseInt(telCount.rows[0].count, 10),
        bufferedEvents: telBuffer.count,
        lastFlush: new Date().toISOString()
      };
    } catch (telErr) {
      console.error('[HEALTH] Falha ao ler métricas de telemetria:', telErr.message);
    }
  } catch (e) {
    health.status = 'DEGRADED';
    health.databases.ecosystem = { status: 'ERROR', error: e.message };
    await logError('HEALTH_ECOSYSTEM', e);
  }

  if (health.status !== 'HEALTHY') {
    await logEvent('SYSTEM_HEALTH', '0', `Estado do sistema: ${health.status}. Detalhes: ${JSON.stringify(health.databases)}`);
  }

  return health;
}

/**
 * Returns true if the remote databases are unreachable.
 */
async function isOfflineMode() {
  try {
    await pool.query('SELECT 1');
    await ecoPool.query('SELECT 1');
    return false;
  } catch (e) {
    return true;
  }
}

module.exports = { checkHealth, isOfflineMode };
