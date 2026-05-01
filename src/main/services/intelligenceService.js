const fs = require('fs');
const path = require('path');
const { hoursSince, clampScore } = require('../utils');
const { ecoPool } = require('../db');

/**
 * Intelligence Service
 * Centralizes all scoring, ranking, and predictive logic.
 */
class IntelligenceService {
  constructor() {
    this.configPath = path.join(__dirname, '..', 'config', 'intelligence_config.json');
    this.config = this._loadConfig();
  }

  _loadConfig() {
    try {
      const data = fs.readFileSync(this.configPath, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      console.warn('[INTEL] Failed to load config, using defaults:', e.message);
      return {
        baseScore: 30,
        abcBonus: { 'A': 25, 'B': 12, 'C': 0 },
        birthdayBonus: 20,
        recencyBonus: {
          hot: { maxDays: 30, bonus: 16 },
          warm: { maxDays: 90, bonus: 8 },
          reactivation: { minDays: 365, bonus: 12 },
          cold: { bonus: 3 }
        },
        sourceBonus: { MANUAL: 15, default: 5 },
        typeBonus: { ALTERAR_CAMPO: 10, default: 4 },
        ageBonus: { pointsPerDay: 1, maxPoints: 20 },
        mlRisk: { minConfidence: 60, multiplier: 0.2 },
        driftBonus: { multiplier: 1.3, bonus: 15 }
      };
    }
  }

  /**
   * Fetches pre-computed ML scores from the database.
   * @param {string} idpessoa - Client ID
   */
  async _getMLScores(idpessoa) {
    try {
      const res = await ecoPool.query(`
        SELECT risk_score, confidence 
        FROM ml_churn_risk 
        WHERE idpessoa = $1
      `, [idpessoa]);
      return res.rows[0] || null;
    } catch (e) {
      console.warn('[ML] Failed to fetch churn risk:', e.message);
      return null;
    }
  }

  /**
   * Calculates the priority score for a client action.
   * @param {Object} data - Client and action data.
   * @returns {number} - Priority score (0-100).
   */
  async calculatePriority(data) {
    let score = this.config.baseScore || 30; // Base Score

    // 1. ABC Class Bonus (High value clients first)
    const abcBonus = (this.config.abcBonus || {})[data.abc] || 0;
    score += abcBonus;

    // 2. Birthday Bonus (High impact relationship)
    const birthdayBonus = data.aniversario_hoje ? (this.config.birthdayBonus || 20) : 0;
    score += birthdayBonus;

    // 3. Recency & Inactivity Analysis
    const recentDays = data.dias_sem_compra || 0;
    const rConfig = this.config.recencyBonus || {};
    let recencyBonus = 0;
    if (rConfig.hot && recentDays <= rConfig.hot.maxDays) recencyBonus = rConfig.hot.bonus;
    else if (rConfig.warm && recentDays <= rConfig.warm.maxDays) recencyBonus = rConfig.warm.bonus;
    else if (rConfig.reactivation && recentDays >= rConfig.reactivation.minDays) recencyBonus = rConfig.reactivation.bonus;
    else if (rConfig.cold) recencyBonus = rConfig.cold.bonus;
    score += recencyBonus;

    // 4. Source & Type
    const sConfig = this.config.sourceBonus || {};
    score += (sConfig[data.origem] !== undefined ? sConfig[data.origem] : (sConfig.default || 5));
    
    const tConfig = this.config.typeBonus || {};
    score += (tConfig[data.tipo_acao] !== undefined ? tConfig[data.tipo_acao] : (tConfig.default || 4));

    // 5. Persistence Bonus: +1 point per 24h since creation, max 20
    const aConfig = this.config.ageBonus || { pointsPerDay: 1, maxPoints: 20 };
    const ageBonus = Math.min(aConfig.maxPoints, Math.floor(hoursSince(data.criado_em) / 24) * aConfig.pointsPerDay);
    score += ageBonus;

    // 6. Churn Risk (Predictive Penalty/Bonus - ML Phase 2)
    const mlRisk = await this._getMLScores(data.idpessoa);
    const mConfig = this.config.mlRisk || { minConfidence: 60, multiplier: 0.2 };
    const dConfig = this.config.driftBonus || { multiplier: 1.3, bonus: 15 };

    if (mlRisk && mlRisk.confidence > mConfig.minConfidence) {
      // High confidence ML model prediction overrides simple heuristics
      score += (mlRisk.risk_score * mConfig.multiplier); 
    } else if (data.freq_dias > 0 && recentDays > (data.freq_dias * dConfig.multiplier)) {
      score += dConfig.bonus; // Escalated priority due to drift (Heuristic fallback)
    }

    return clampScore(score);
  }

  /**
   * Analyzes client behavior to generate actionable insights.
   * @param {Object} profile - Client profile data.
   * @param {Object} stats - Client purchasing stats.
   * @param {Object} priorityData - Pre-calculated priority indicators.
   * @returns {Array<string>} - List of insight strings.
   */
  async generateInsights(profile, stats, priorityData) {
    const insights = [];
    
    // Status Indicators
    if (priorityData.abc === 'A') insights.push('Cliente Diamante (ABC A) 💎');
    if (priorityData.aniversario_hoje) insights.push('Aniversariante hoje 🎂');
    
    // Recency Insights
    if (priorityData.dias_sem_compra >= 365) {
      insights.push('Inativo ha mais de 1 ano');
    } else if (priorityData.dias_sem_compra <= 30) {
      insights.push('Cliente ativo recente');
    }

    // Health Indicators
    if (profile.stpessoa === 'B') insights.push('Cliente Bloqueado ⚠️');
    
    // Predictive Insights (ML Phase 2)
    const mlRisk = await this._getMLScores(profile.idpessoa);
    if (mlRisk && mlRisk.risk_score > 75 && mlRisk.confidence > 70) {
      insights.push(`Alto Risco de Evasao (Confianca: ${mlRisk.confidence}%) 🔥`);
    } else {
      // Heuristic fallback
      const freq = stats.freq_dias || 0;
      const sinceLast = priorityData.dias_sem_compra || 0;
      if (freq > 0) {
        if (sinceLast > (freq * 2)) {
          insights.push('Alto Risco de Churn (2x ciclo medio)');
        } else if (sinceLast > (freq * 1.3)) {
          insights.push('Atraso no ciclo de compra detectado');
        }
      }
    }

    // Value Insights
    if (stats.valor_lifetime > 5000) {
      insights.push('Alto valor acumulado (LTV)');
    }

    return insights;
  }

  /**
   * Fetches high-affinity product recommendations for a client.
   * @param {string} idpessoa - Client ID
   * @param {number} limit - Max recommendations
   */
  async getProductRecommendations(idpessoa, limit = 5) {
    try {
      const res = await ecoPool.query(`
        SELECT idproduto, affinity_score, reason_code
        FROM ml_product_affinity
        WHERE idpessoa = $1
        ORDER BY affinity_score DESC
        LIMIT $2
      `, [idpessoa, limit]);
      return res.rows;
    } catch (e) {
      console.warn('[ML] Failed to fetch affinity recommendations:', e.message);
      return [];
    }
  }
}

module.exports = new IntelligenceService();
