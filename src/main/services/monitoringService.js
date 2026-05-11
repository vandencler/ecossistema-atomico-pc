const os = require('os');
const { pool, ecoPool } = require('../db');
const healthService = require('./healthService');
const { logEvent, logError } = require('./logService');

/**
 * Monitoring Service
 * Orchestrates 24/7 technical and business monitoring for the EAV platform.
 * Persists snapshots for trend analysis and handles critical alerting.
 */
class MonitoringService {
  constructor() {
    this.interval = null;
    this.isMonitoring = false;
  }

  /**
   * Starts the monitoring loop.
   * @param {number} intervalMs - Interval between snapshots (default 5 mins)
   */
  start(intervalMs = 5 * 60 * 1000) {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    this.interval = setInterval(() => this.takeSnapshot(), intervalMs);
    console.log(`[MONITOR] 24/7 Monitoring started (Interval: ${intervalMs / 1000}s)`);
    // Take first snapshot immediately
    this.takeSnapshot().catch(err => console.error('[MONITOR] Initial snapshot failed:', err.message));
  }

  /**
   * Stops the monitoring loop.
   */
  stop() {
    if (this.interval) clearInterval(this.interval);
    this.isMonitoring = false;
    console.log('[MONITOR] Monitoring stopped.');
  }

  /**
   * Captures a complete snapshot of system and business health.
   */
  async takeSnapshot() {
    try {
      const startTime = Date.now();
      const technicalHealth = await healthService.checkHealth();
      
      const metrics = {
        technical: technicalHealth,
        system: {
          cpu_load: os.loadavg(),
          free_mem_mb: Math.round(os.freemem() / (1024 * 1024)),
          total_mem_mb: Math.round(os.totalmem() / (1024 * 1024)),
          uptime_days: (os.uptime() / (60 * 60 * 24)).toFixed(2)
        },
        business: await this._getBusinessMetrics(),
        ml: await this._getMLMetrics()
      };

      const duration = Date.now() - startTime;
      metrics.monitoring_duration_ms = duration;

      const status = this._determineStatus(metrics);
      const summary = this._generateSummary(metrics, status);

      // Persist to database
      await ecoPool.query(`
        INSERT INTO monitoring_snapshots (status, metrics, summary)
        VALUES ($1, $2, $3)
      `, [status, JSON.stringify(metrics), summary]);

      if (status === 'CRITICAL' || (status === 'DEGRADED' && technicalHealth.status === 'DEGRADED')) {
        await logEvent('MONITOR_ALERT', '0', `Alerta de Monitoramento (${status}): ${summary}`);
      }

      return { status, metrics, summary };
    } catch (e) {
      await logError('MONITOR_SNAPSHOT_FAIL', e);
      throw e;
    }
  }

  async _getBusinessMetrics() {
    const metrics = {};
    try {
      // SAV Queue Status
      const savRes = await ecoPool.query(`
        SELECT status, COUNT(*) as count
        FROM acoes_pendentes
        WHERE criado_em > NOW() - INTERVAL '24 hours'
        GROUP BY status
      `);
      metrics.sav_status_24h = savRes.rows.reduce((acc, r) => {
        acc[r.status] = parseInt(r.count);
        return acc;
      }, {});

      // Sync Latency (Recent items)
      const latencyRes = await ecoPool.query(`
        SELECT 
          AVG(EXTRACT(EPOCH FROM (executado_em - aprovado_em))) as avg_latency_sec
        FROM acoes_pendentes
        WHERE status = 'CONCLUIDO' 
          AND aprovado_em IS NOT NULL
          AND executado_em > NOW() - INTERVAL '1 hour'
      `);
      metrics.sync_latency_1h_avg = Math.round(latencyRes.rows[0].avg_latency_sec || 0);

      // Error rate
      const errorRes = await ecoPool.query(`
        SELECT COUNT(*) as count
        FROM log_eventos
        WHERE (tipo LIKE '%_ERROR' OR tipo LIKE '%_FAIL')
          AND criado_em > NOW() - INTERVAL '1 hour'
      `);
      metrics.errors_last_hour = parseInt(errorRes.rows[0].count);

    } catch (e) {
      console.warn('[MONITOR] Failed to fetch business metrics:', e.message);
    }
    return metrics;
  }

  async _getMLMetrics() {
    const metrics = {};
    try {
      // Freshness
      const driftRes = await ecoPool.query('SELECT MAX(calculado_em) as last_calc FROM ml_churn_risk');
      metrics.churn_last_update = driftRes.rows[0].last_calc;
      
      const sentimentRes = await ecoPool.query(`
        SELECT sentiment_label, COUNT(*) as count
        FROM ml_client_sentiment
        GROUP BY sentiment_label
      `);
      metrics.sentiment_distribution = sentimentRes.rows.reduce((acc, r) => {
        acc[r.sentiment_label] = parseInt(r.count);
        return acc;
      }, {});

    } catch (e) {
      console.warn('[MONITOR] Failed to fetch ML metrics:', e.message);
    }
    return metrics;
  }

  _determineStatus(metrics) {
    if (metrics.technical.status === 'ERROR') return 'CRITICAL';
    if (metrics.technical.status === 'DEGRADED') return 'DEGRADED';
    
    // Check production connectivity as a critical factor for governed writes
    if (metrics.technical.databases.production?.status === 'ERROR') return 'DEGRADED';
    
    // Check business rules
    if (metrics.business.errors_last_hour > 50) return 'CRITICAL';
    if (metrics.business.sync_latency_1h_avg > 300) return 'DEGRADED'; // 5 mins
    
    return 'HEALTHY';
  }

  _generateSummary(metrics, status) {
    const parts = [
      `Status: ${status}`,
      `DB Mirror: ${metrics.technical.databases.mirror.status}`,
      `DB Prod: ${metrics.technical.databases.production?.status || 'UNKNOWN'}`,
      `SAV Pendentes: ${metrics.business.sav_status_24h?.PENDENTE || 0}`,
      `Erros (1h): ${metrics.business.errors_last_hour || 0}`,
      `Mem Livre: ${metrics.system.free_mem_mb}MB`
    ];
    return parts.join(' | ');
  }

  /**
   * Returns recent snapshots for dashboard visualization.
   */
  async getRecentSnapshots(limit = 24) {
    const res = await ecoPool.query(`
      SELECT snapshot_time, status, summary, metrics->'business' as biz, metrics->'technical' as tech
      FROM monitoring_snapshots
      ORDER BY snapshot_time DESC
      LIMIT $1
    `, [limit]);
    return res.rows;
  }
}

module.exports = new MonitoringService();
