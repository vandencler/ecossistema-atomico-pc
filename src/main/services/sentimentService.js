const { ecoPool } = require('../db');
const { logError, logEvent } = require('./logService');

/**
 * Sentiment Service
 * Handles keyword-based sentiment analysis for inbound messages.
 */
class SentimentService {
  constructor() {
    this.negWords = ['lento', 'travando', 'erro', 'ruim', 'dificil', 'bug', 'parou', 'problema', 'pessimo', 'atraso'];
    this.posWords = ['rapido', 'facil', 'ajudou', 'bom', 'parabens', 'top', 'otimo', 'excelente', 'vendi', 'sucesso', 'sensacional', 'maravilha', 'show'];
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
   * Analyzes a single message and updates the client sentiment record.
   */
  async analyzeMessage(idpessoa, content) {
    if (!content) return;
    const msg = this.normalize(content);

    let negHits = 0;
    let posHits = 0;

    this.negWords.forEach(w => { if (msg.includes(this.normalize(w))) negHits++; });
    this.posWords.forEach(w => { if (msg.includes(this.normalize(w))) posHits++; });

    if (negHits === 0 && posHits === 0) return;

    let score = 0;
    if (negHits > posHits) {
      score = -0.5 * Math.min(2, negHits);
    } else if (posHits > negHits) {
      score = 0.5 * Math.min(2, posHits);
    }

    const label = score < -0.2 ? 'NEGATIVE' : (score > 0.2 ? 'POSITIVE' : 'NEUTRAL');

    try {
      await ecoPool.query(`
        INSERT INTO ml_client_sentiment (idpessoa, sentiment_score, sentiment_label, last_message_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (idpessoa) DO UPDATE SET
          sentiment_score = (ml_client_sentiment.sentiment_score + EXCLUDED.sentiment_score) / 2.0,
          sentiment_label = CASE
            WHEN ((ml_client_sentiment.sentiment_score + EXCLUDED.sentiment_score) / 2.0) < -0.2 THEN 'NEGATIVE'
            WHEN ((ml_client_sentiment.sentiment_score + EXCLUDED.sentiment_score) / 2.0) > 0.2 THEN 'POSITIVE'
            ELSE 'NEUTRAL'
          END,
          last_message_at = EXCLUDED.last_message_at,
          calculado_em = CURRENT_TIMESTAMP
      `, [idpessoa, score, label]);

      await logEvent('ML_SENTIMENT_UPDATED', idpessoa, `Sentiment analyzed: ${label} (score: ${score})`);
    } catch (e) {
      await logError('ML_SENTIMENT_ANALYSIS', e, idpessoa);
    }
  }

  async batchAnalyze() {
    console.log('[SENTIMENT] Running batch analysis...');
    try {
      const res = await ecoPool.query(`
        SELECT idpessoa, conteudo, criado_em
        FROM omnichannel_mensagens
        WHERE direcao = 'INBOUND'
        ORDER BY criado_em ASC
      `);

      for (const row of res.rows) {
        await this.analyzeMessage(row.idpessoa, row.conteudo);
      }
      console.log(`[SENTIMENT] Batch analysis complete. Processed ${res.rows.length} messages.`);
    } catch (e) {
      await logError('ML_SENTIMENT_BATCH', e);
    }
  }
}

module.exports = new SentimentService();
