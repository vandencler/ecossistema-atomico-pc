const { ecoPool, pool } = require('../db');
const { logEvent, logError } = require('./logService');
const { trackEvent } = require('./telemetryService');
const { getConfigValue } = require('./configService');
const omnichannelService = require('./omnichannelService');

/**
 * NPS Service
 * Handles the automated collection and processing of Net Promoter Score surveys.
 * Aligned with Phase 6 Growth Strategy.
 */
class NpsService {
  /**
   * Runs the NPS cycle: identifies eligible users and sends surveys.
   * Typically called by a background scheduler.
   */
  async runCycle() {
    const enabled = await getConfigValue('nps_survey_enabled', 'true');
    if (enabled !== 'true') return;

    console.log('[NPS] Iniciando ciclo de coleta de NPS...');

    try {
      // 1. Find users (reps) active for more than X days who haven't received a survey yet
      const delayDays = await getConfigValue('nps_survey_delay_days', '7');
      
      // We look at telemetry_events to find when the user first logged in
      // We only consider REAL user events like 'APP_LOAD' to avoid picking up 
      // customers from automated background telemetry.
      const eligibleUsers = await ecoPool.query(`
        WITH first_activity AS (
          SELECT user_id, MIN(occurred_at) as first_active
          FROM telemetry_events
          WHERE user_id NOT IN ('unknown', 'system', 'sync-service')
            AND event_name = 'APP_LOAD'
          GROUP BY user_id
        )
        SELECT fa.user_id, fa.first_active
        FROM first_activity fa
        LEFT JOIN nps_scores ns ON fa.user_id = ns.user_id
        WHERE fa.first_active < CURRENT_TIMESTAMP - (INTERVAL '1 day' * $1::text::integer)
          AND ns.id IS NULL; -- Only send if they haven't received one yet
      `, [delayDays]);
      console.log(`[NPS] Encontrados ${eligibleUsers.rows.length} usuários elegíveis para NPS.`);

      for (const row of eligibleUsers.rows) {
        await this.sendNpsIfEligible(row.user_id);
      }

    } catch (e) {
      await logError('NPS_CYCLE', e);
      console.error('[NPS] Erro no ciclo:', e.message);
    }
  }

  /**
   * Sends NPS survey to a specific user if they are found in the ERP database.
   * @param {string} userId - User identity (from app_identity/telemetry).
   */
  async sendNpsIfEligible(userId) {
    try {
      // Find the idpessoa (ERP primary key) for this user identity
      // It might be the userId itself, or the cdchamada (Sellers usually have numeric codes)
      const checkRes = await pool.query(`
        SELECT idpessoa, nmpessoa, nrtelefone, campostelwhatsapp, nrpager
        FROM wshop.pessoas 
        WHERE (idpessoa = $1 OR cdchamada = $1)
          AND stvendedor = true
        LIMIT 1
      `, [userId]);
      
      if (checkRes.rows.length === 0) {
        // Log skip without failure; it might be a mock user or generic login
        console.warn(`[NPS] Usuario ${userId} nao encontrado ou nao e Vendedor no Mirror DB. Pulando disparo.`);
        await logEvent('NPS_SKIP', userId, 'Identidade nao encontrada ou nao e Vendedor no Mirror DB.');
        return;
      }

      const { idpessoa, nmpessoa, nrtelefone, campostelwhatsapp, nrpager } = checkRes.rows[0];

      // Verification: Does the seller have a phone?
      if (!nrtelefone && !campostelwhatsapp && !nrpager) {
        console.warn(`[NPS] Vendedor ${nmpessoa} (${idpessoa}) nao possui telefone cadastrado. Impossivel enviar WhatsApp.`);
        await logEvent('NPS_DATA_ERROR', idpessoa, `Vendedor sem telefone para NPS: ${nmpessoa}`);
        return;
      }

      const message = await getConfigValue('nps_survey_message', 'Olá! Você está usando o EAV há uma semana. Em uma escala de 0 a 10, o quanto o sistema facilitou suas vendas?');
      
      console.log(`[NPS] Disparando pesquisa para ${nmpessoa} (${idpessoa})`);
      const res = await omnichannelService.sendWhatsAppMessage(idpessoa, message);

      if (res.ok) {
        await ecoPool.query(`
          INSERT INTO nps_scores (user_id, idpessoa, status)
          VALUES ($1, $2, 'SENT')
        `, [userId, idpessoa]);
        
        await logEvent('NPS_SENT', idpessoa, `Pesquisa NPS enviada para usuário ${userId}.`);
        await trackEvent('nps_survey_sent', userId, { idpessoa });
      }

    } catch (e) {
      await logError('NPS_SEND', e, userId);
      console.error(`[NPS] Falha ao enviar para ${userId}:`, e.message);
    }
  }

  /**
   * Processes an inbound message content to check for numeric NPS scores.
   * @param {string} idpessoa - Sender ID.
   * @param {string} content - Message text.
   * @returns {Promise<boolean>} - True if processed as NPS.
   */
  async processResponse(idpessoa, content) {
    try {
      // Find the most recent 'SENT' survey for this person
      const nps = await ecoPool.query(`
        SELECT * FROM nps_scores
        WHERE idpessoa = $1 AND status = 'SENT'
        ORDER BY enviado_em DESC
        LIMIT 1
      `, [idpessoa]);

      if (nps.rows.length === 0) return false;

      // Extract number 0-10 from the message
      const match = content.match(/\b([0-9]|10)\b/);
      if (match) {
        const score = parseInt(match[1], 10);
        
        await ecoPool.query(`
          UPDATE nps_scores
          SET score = $1, comentario = $2, status = 'RESPONDED', respondido_em = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [score, content, nps.rows[0].id]);

        await logEvent('NPS_RESPONSE', idpessoa, `Resposta NPS recebida: ${score}.`);
        
        // Sentiment Classification Logic (CMO Strategy)
        let classification = 'PASSIVE';
        if (score >= 9) classification = 'PROMOTER';
        if (score <= 6) classification = 'DETRACTOR';

        await trackEvent('nps_score_received', nps.rows[0].user_id, { 
          score, 
          classification,
          idpessoa 
        });

        console.log(`[NPS] Resposta processada para ${idpessoa}: ${score} (${classification})`);

        // Send Thank You Message (Phase 6 Strategy)
        const thankYouMsg = await getConfigValue('nps_thank_you_message', 'Obrigado pelo seu feedback! Ele é fundamental para continuarmos evoluindo o EAV.');
        await omnichannelService.sendWhatsAppMessage(idpessoa, thankYouMsg);

        return true;
      }

      return false;
    } catch (e) {
      await logError('NPS_PROCESS', e, idpessoa);
      return false;
    }
  }

  /**
   * Generates a summary for the CMO report.
   */
  async getSummary() {
    const res = await ecoPool.query(`
      SELECT 
        COUNT(*) as total,
        AVG(score) FILTER (WHERE status = 'RESPONDED') as avg_score,
        COUNT(*) FILTER (WHERE score >= 9) as promoters,
        COUNT(*) FILTER (WHERE score <= 6) as detractors,
        COUNT(*) FILTER (WHERE status = 'RESPONDED') as responses
      FROM nps_scores
    `);
    
    const data = res.rows[0];
    const totalResp = parseInt(data.responses);
    const nps = totalResp > 0 
      ? ((parseInt(data.promoters) - parseInt(data.detractors)) / totalResp) * 100 
      : 0;

    return {
      nps: Math.round(nps),
      avg: parseFloat(data.avg_score || 0).toFixed(1),
      promoters: parseInt(data.promoters),
      detractors: parseInt(data.detractors),
      total_sent: parseInt(data.total)
    };
  }
}

module.exports = new NpsService();
