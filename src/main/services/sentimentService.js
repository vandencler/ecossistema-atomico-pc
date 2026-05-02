const { ecoPool } = require('../db');
const { logError, logEvent } = require('./logService');

/**
 * Sentiment Service
 * Handles advanced keyword-based sentiment analysis for inbound messages and UX feedback.
 * Features time-decay weighting and cross-table integration.
 */
class SentimentService {
  constructor() {
    this.negWords = ['lento', 'travando', 'erro', 'ruim', 'dificil', 'bug', 'parou', 'problema', 'pessimo', 'atraso', 'falha', 'horrivel', 'limitado', 'confuso', 'complicado', 'caro', 'absurdo', 'demora', 'insatisfeito', 'errado', 'mentira', 'engano', 'horrivel', 'pior', 'desistindo', 'cansado', 'reclamar', 'nao funciona', 'nao funciona', 'parado', 'trancado', 'bloqueado'];
    this.posWords = ['rapido', 'facil', 'ajudou', 'bom', 'parabens', 'top', 'otimo', 'excelente', 'vendi', 'sucesso', 'amando', 'perfeito', 'incrivel', 'parabens', 'agilidade', 'recomendo', 'gostei', 'amei', 'obrigado', 'show', 'show de bola', 'eficiente', 'maravilhoso', 'sensacional', 'parabens', 'top demais', 'ajuda muito', 'facilitou', 'venda concluida'];
  }

  /**
   * Normalizes text by removing accents and making it lowercase.
   */
  normalize(text) {
    if (!text) return '';
    return text.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * Re-calculates and updates the global sentiment for a client.
   * Considers messages and UX feedback with time-decay.
   */
  async refreshClientSentiment(idpessoa) {
    try {
      // 1. Fetch recent messages
      const msgRes = await ecoPool.query(`
        SELECT conteudo, criado_em
        FROM omnichannel_mensagens
        WHERE idpessoa = $1 AND direcao = 'INBOUND'
          AND criado_em > CURRENT_TIMESTAMP - INTERVAL '30 days'
      `, [idpessoa]);

      // 2. Fetch recent UX feedback
      const uxRes = await ecoPool.query(`
        SELECT satisfaction, comment, criado_em
        FROM app_feedback
        WHERE user_id = $1
          AND criado_em > CURRENT_TIMESTAMP - INTERVAL '30 days'
      `, [idpessoa]);

      let totalScore = 0;
      let totalWeight = 0;
      let lastAt = null;
      const now = new Date();

      // Process Messages
      msgRes.rows.forEach(r => {
        const msg = this.normalize(r.conteudo);
        let msgScore = 0;
        let negHits = 0;
        let posHits = 0;
        
        this.negWords.forEach(w => { if (msg.includes(this.normalize(w))) negHits++; });
        this.posWords.forEach(w => { if (msg.includes(this.normalize(w))) posHits++; });

        if (negHits > posHits) msgScore = -1;
        else if (posHits > negHits) msgScore = 1;
        
        if (msgScore !== 0) {
          const ageDays = (now - new Date(r.criado_em)) / (1000 * 60 * 60 * 24);
          const weight = Math.max(0.2, 1.0 - (ageDays / 30));
          totalScore += msgScore * weight;
          totalWeight += weight;
        }
        if (!lastAt || r.criado_em > lastAt) lastAt = r.criado_em;
      });

      // Process UX Feedback
      uxRes.rows.forEach(r => {
        // Map satisfaction 1 -> -1, 2 -> 0, 3 -> 1
        const mappedScore = r.satisfaction === 1 ? -1 : (r.satisfaction === 3 ? 1 : 0);
        const ageDays = (now - new Date(r.criado_em)) / (1000 * 60 * 60 * 24);
        const weight = Math.max(0.4, 1.2 - (ageDays / 30)); // Higher weight for formal feedback
        
        totalScore += mappedScore * weight;
        totalWeight += weight;

        // Also analyze comment if present
        if (r.comment) {
          const comment = this.normalize(r.comment);
          let cScore = 0;
          this.negWords.forEach(w => { if (comment.includes(this.normalize(w))) cScore--; });
          this.posWords.forEach(w => { if (comment.includes(this.normalize(w))) cScore++; });
          
          if (cScore !== 0) {
            totalScore += (cScore > 0 ? 1 : -1) * weight * 0.5; // Modifier weight
            totalWeight += weight * 0.5;
          }
        }
        if (!lastAt || r.criado_em > lastAt) lastAt = r.criado_em;
      });

      if (totalWeight === 0) return;

      const finalScore = totalScore / totalWeight;
      const label = finalScore < -0.2 ? 'NEGATIVE' : (finalScore > 0.2 ? 'POSITIVE' : 'NEUTRAL');

      await ecoPool.query(`
        INSERT INTO ml_client_sentiment (idpessoa, sentiment_score, sentiment_label, last_message_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (idpessoa) DO UPDATE SET
          sentiment_score = EXCLUDED.sentiment_score,
          sentiment_label = EXCLUDED.sentiment_label,
          last_message_at = EXCLUDED.last_message_at,
          calculado_em = CURRENT_TIMESTAMP
      `, [idpessoa, finalScore.toFixed(2), label, lastAt || now]);

    } catch (e) {
      await logError('ML_SENTIMENT_REFRESH', e, idpessoa);
    }
  }

  /**
   * Alias for backward compatibility or individual message ingestion.
   */
  async analyzeMessage(idpessoa, _content) {
    await this.refreshClientSentiment(idpessoa);
  }

  /**
   * Batch refresh for all active clients with recent interactions.
   */
  async batchAnalyze() {
    console.log('[SENTIMENT] Running full system batch refresh...');
    try {
      const res = await ecoPool.query(`
        SELECT DISTINCT idpessoa FROM (
          SELECT idpessoa FROM omnichannel_mensagens WHERE criado_em > NOW() - INTERVAL '30 days'
          UNION
          SELECT user_id as idpessoa FROM app_feedback WHERE criado_em > NOW() - INTERVAL '30 days'
        ) t
      `);

      for (const row of res.rows) {
        await this.refreshClientSentiment(row.idpessoa);
      }
      console.log(`[SENTIMENT] Batch refresh complete for ${res.rowCount} clients.`);
    } catch (e) {
      await logError('ML_SENTIMENT_BATCH', e);
    }
  }
}

module.exports = new SentimentService();
