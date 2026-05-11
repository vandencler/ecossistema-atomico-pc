const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { hoursSince, clampScore } = require('../utils');
const { ecoPool } = require('../db');
const { getLocalDb } = require('../localDb');
const telemetry = require('./telemetryService');

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
        driftBonus: { multiplier: 1.3, bonus: 15 },
        abTesting: { enabled: false, ratio: 0.5 }
      };
    }
  }

  /**
   * Determina o grupo de teste A/B para um cliente de forma determinística.
   * @param {string} idpessoa 
   * @returns {'A' | 'B'}
   */
  _getABGroup(idpessoa) {
    if (!this.config.abTesting?.enabled) return 'B';
    
    const hash = crypto.createHash('md5').update(idpessoa).digest('hex');
    const decimal = parseInt(hash.substring(0, 4), 16);
    const normalized = decimal / 65535;
    
    return normalized < (this.config.abTesting.ratio || 0.5) ? 'A' : 'B';
  }

  /**
   * Fetches pre-computed ML scores from the database.
   * Fallback to local cache if PostgreSQL is unavailable.
   * @param {string} idpessoa - Client ID
   */
  async _getMLScores(idpessoa) {
    try {
      // 1. Try PostgreSQL (Authoritative)
      const res = await ecoPool.query(`
        SELECT risk_score, confidence, reason_code, reason_detail
        FROM ml_churn_risk 
        WHERE idpessoa = $1
      `, [idpessoa]);
      return res.rows[0] || null;
    } catch (e) {
      console.warn('[ML] PostgreSQL fetch failed for churn risk, falling back to cache:', e.message);
      
      try {
        // 2. Try Local Cache (Resilience)
        const db = getLocalDb();
        const row = db.prepare('SELECT risk_score, confidence, reason_code, reason_detail FROM ml_churn_risk WHERE idpessoa = ?').get(idpessoa);
        return row || null;
      } catch (cacheErr) {
        console.warn('[ML] Local cache fetch failed for churn risk:', cacheErr.message);
        return null;
      }
    }
  }

  /**
   * Fetches client sentiment from the database.
   * Fallback to local cache if PostgreSQL is unavailable.
   * @param {string} idpessoa - Client ID
   */
  async _getSentiment(idpessoa) {
    try {
      // 1. Try PostgreSQL
      const res = await ecoPool.query(`
        SELECT sentiment_score, sentiment_label 
        FROM ml_client_sentiment 
        WHERE idpessoa = $1
      `, [idpessoa]);
      return res.rows[0] || null;
    } catch (e) {
      console.warn('[ML] PostgreSQL fetch failed for sentiment, falling back to cache:', e.message);

      try {
        // 2. Try Local Cache
        const db = getLocalDb();
        const row = db.prepare('SELECT sentiment_score, sentiment_label FROM ml_client_sentiment WHERE idpessoa = ?').get(idpessoa);
        return row || null;
      } catch (cacheErr) {
        console.warn('[ML] Local cache fetch failed for sentiment:', cacheErr.message);
        return null;
      }
    }
  }

  /**
   * Fetches recent WhatsApp engagement metrics.
   */
  async _getWhatsAppEngagement(idpessoa) {
    try {
      const res = await ecoPool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE direcao = 'INBOUND') as inbound_count,
          COUNT(*) FILTER (WHERE direcao = 'OUTBOUND') as outbound_count,
          MAX(criado_em) as last_interaction
        FROM omnichannel_mensagens
        WHERE idpessoa = $1 AND criado_em > CURRENT_TIMESTAMP - INTERVAL '7 days'
      `, [idpessoa]);
      return res.rows[0] || { inbound_count: 0, outbound_count: 0, last_interaction: null };
    } catch (e) {
      console.warn('[INTEL] Failed to fetch WhatsApp engagement:', e.message);
      return { inbound_count: 0, outbound_count: 0, last_interaction: null };
    }
  }

  /**
   * Calculates the priority score for a client action.
   * @param {Object} data - Client and action data.
   * @returns {number} - Priority score (0-100).
   */
  async calculatePriority(data, forcedGroup = null) {
    const abGroup = forcedGroup || this._getABGroup(data.idpessoa);
    let score = this.config.baseScore || 30;

    // 1. ABC Class Bonus
    const abcBonus = (this.config.abcBonus || {})[data.abc] || 0;
    score += abcBonus;

    // 2. Birthday Bonus
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

    // 5. Persistence Bonus
    const aConfig = this.config.ageBonus || { pointsPerDay: 1, maxPoints: 20 };
    const ageBonus = Math.min(aConfig.maxPoints, Math.floor(hoursSince(data.criado_em) / 24) * aConfig.pointsPerDay);
    score += ageBonus;

    // 6. WhatsApp Engagement
    const waEngagement = data.waEngagement || await this._getWhatsAppEngagement(data.idpessoa);
    const waConfig = this.config.whatsappBonus || { inbound: 15, outbound: 5 };
    if (parseInt(waEngagement.inbound_count) > 0) score += waConfig.inbound;
    else if (parseInt(waEngagement.outbound_count) > 0) score += waConfig.outbound;

    // 7. Churn Risk (A/B Selection)
    const mlRisk = data.mlRisk || await this._getMLScores(data.idpessoa);
    const mConfig = this.config.mlRisk || { minConfidence: 60, multiplier: 0.2 };
    const dConfig = this.config.driftBonus || { multiplier: 1.3, bonus: 15 };

    if (mlRisk && parseFloat(mlRisk.confidence) > mConfig.minConfidence) {
      if (abGroup === 'A') {
        if (parseFloat(mlRisk.risk_score) > 70) score += 15;
      } else {
        score += (parseFloat(mlRisk.risk_score) * mConfig.multiplier); 
      }
    } else if (data.freq_dias > 0 && recentDays > (data.freq_dias * dConfig.multiplier)) {
      score += dConfig.bonus;
    }

    // 8. Product Affinity
    const recs = data.productAffinity || await this.getProductRecommendations(data.idpessoa, 1);
    const affinityConfig = this.config.affinityBonus || { minScore: 80, bonus: 10 };
    if (recs.length > 0 && parseFloat(recs[0].affinity_score) >= affinityConfig.minScore) {
      score += affinityConfig.bonus;
    }

    // 9. Client Sentiment
    const sentiment = data.sentiment || await this._getSentiment(data.idpessoa);
    if (sentiment) {
      if (sentiment.sentiment_label === 'NEGATIVE') score += 20;
      else if (sentiment.sentiment_label === 'POSITIVE') score -= 5;
    }

    // 10. Client Profile (New: Phase 6 Lookalike & Risk)
    const profile = data.mlProfile || null;
    if (profile) {
      // 10a. Credit Block Penalty
      if (profile.stcredbloqueado) score -= 40; 

      // 10b. Lookalike / City Potential (e.g. Sorocaba)
      if (profile.cidade === 'Sorocaba' && (data.abc === 'C' || !data.abc)) {
        score += 15; // High potential in core market
      }

      // 10c. Profile Completeness Bonus
      let completeness = 0;
      if (profile.sexo) completeness++;
      if (profile.data_nascimento) completeness++;
      if (profile.dtcadastro) completeness++;
      if (completeness >= 2) score += 5;
    }

    const finalScore = clampScore(score);

    telemetry.trackEvent('intel_score_calculated', 'system', {
      idpessoa: data.idpessoa,
      score: finalScore,
      group: abGroup,
      origin: data.origem,
      type: data.tipo_acao
    });

    return finalScore;
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
    
    if (priorityData.abc === 'A') insights.push('Cliente Diamante (ABC A) 💎');
    if (priorityData.aniversario_hoje) insights.push('Aniversariante hoje 🎂');
    
    if (priorityData.dias_sem_compra >= 365) {
      insights.push('Inativo ha mais de 1 ano');
    } else if (priorityData.dias_sem_compra <= 30) {
      insights.push('Cliente ativo recente');
    }

    if (profile.stpessoa === 'B') insights.push('Cliente Bloqueado ⚠️');
    
    const mlRisk = priorityData.mlRisk || await this._getMLScores(profile.idpessoa);
    if (mlRisk && parseFloat(mlRisk.risk_score) > 75 && parseFloat(mlRisk.confidence) > 70) {
      insights.push(`Alto Risco de Evasao (Confianca: ${mlRisk.confidence}%) 🔥`);
      if (mlRisk.reason_detail) insights.push(`Motivo: ${mlRisk.reason_detail}`);
    } else {
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

    const sentiment = priorityData.sentiment || await this._getSentiment(profile.idpessoa);
    if (sentiment) {
      if (sentiment.sentiment_label === 'NEGATIVE') insights.push('Sentimento Negativo detectado 😡');
      else if (sentiment.sentiment_label === 'POSITIVE') insights.push('Cliente Satisfeito 😊');
    }

    const recs = priorityData.productAffinity || await this.getProductRecommendations(profile.idpessoa, 1);
    if (recs.length > 0 && parseFloat(recs[0].affinity_score) > 85) {
      const rec = recs[0];
      let prefix = 'Oportunidade';
      if (rec.reason_code === 'CROSS_SELL_BOUGHT_TOGETHER') prefix = 'Sugestao (Cross-sell)';
      else if (rec.reason_code === 'CORE_PRODUCT') prefix = 'Produto Essencial';
      else if (rec.reason_code === 'HIGH_HISTORICAL_VOLUME') prefix = 'Alto Volume';
      
      insights.push(`${prefix}: Alta afinidade com produto ${rec.idproduto} 🎯`);
      if (rec.pitch) insights.push(`Dica: "${rec.pitch}"`);
    } else {
      const trending = await this.getTrendingProducts();
      if (trending.length > 0) {
        const top = trending[0];
        insights.push(`Tendencia: O produto ${top.idprod} esta com alta nas vendas! 📈`);
      }
    }

    if (stats.valor_lifetime > 5000) {
      insights.push('Alto valor acumulado (LTV)');
    }

    return insights;
  }

  /**
   * Fetches high-affinity product recommendations for a client.
   * Fallback to local cache if PostgreSQL is unavailable.
   * @param {string} idpessoa - Client ID
   * @param {number} limit - Max recommendations
   */
  async getProductRecommendations(idpessoa, limit = 5) {
    try {
      const res = await ecoPool.query(`
        SELECT idproduto, affinity_score, reason_code, pitch
        FROM ml_product_affinity
        WHERE idpessoa = $1
        ORDER BY affinity_score DESC
        LIMIT $2
      `, [idpessoa, limit]);
      return res.rows;
    } catch (e) {
      console.warn('[ML] PostgreSQL fetch failed for affinity, falling back to cache:', e.message);

      try {
        const db = getLocalDb();
        const rows = db.prepare(`
          SELECT idproduto, affinity_score, reason_code, pitch
          FROM ml_product_affinity
          WHERE idpessoa = ?
          ORDER BY affinity_score DESC
          LIMIT ?
        `).all(idpessoa, limit);
        return rows;
      } catch (cacheErr) {
        console.warn('[ML] Local cache fetch failed for affinity:', cacheErr.message);
        return [];
      }
    }
  }

  /**
   * Fetches the top trending products globally.
   */
  async getTrendingProducts() {
    try {
      const res = await ecoPool.query("SELECT valor FROM config_sistema WHERE chave = 'TRENDING_PRODUCTS'");
      if (res.rows.length > 0) {
        return JSON.parse(res.rows[0].valor);
      }
      return [];
    } catch (e) {
      console.warn('[INTEL] Failed to fetch trending products:', e.message);
      return [];
    }
  }
}

module.exports = new IntelligenceService();
