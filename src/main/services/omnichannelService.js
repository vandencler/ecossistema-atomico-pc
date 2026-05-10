const { pool, ecoPool } = require('../db');
const { logEvent, logError } = require('./logService');
const { trackEvent } = require('./telemetryService');
const { getConfigValue } = require('./configService');
const { normalizeBrazilianPhone } = require('../utils');
const purgeService = require('./purgeService');

/**
 * Omnichannel Service
 * Handles outbound communications to external APIs (e.g., WhatsApp Business API, Twilio, Meta Cloud API).
 */
class OmnichannelService {
  /**
   * Sanitizes a raw phone string into a standard WhatsApp format (55+DDD+Number).
   * @param {string} raw - Raw phone number.
   * @returns {string|null} - Sanitized digits or null if invalid.
   */
  sanitizePhone(raw) {
    if (!raw) return null;
    
    // Use the standardized normalization logic (adds 9th digit if missing)
    const normalized = normalizeBrazilianPhone(raw);
    if (!normalized) return null;

    return `55${normalized}`;
  }

  /**
   * Retrieves the primary sanitized phone number for a client.
   */
  async _getClientPhone(idpessoa) {
    try {
      const res = await pool.query(`
        SELECT campostelwhatsapp, nrtelefone, nrpager
        FROM wshop.pessoas
        WHERE idpessoa = $1
      `, [idpessoa]);

      const p = res.rows[0];
      if (!p) return null;

      const candidates = [p.campostelwhatsapp, p.nrtelefone, p.nrpager];
      for (const raw of candidates) {
        const sanitized = this.sanitizePhone(raw);
        if (sanitized) return sanitized;
      }

      return null;
    } catch (e) {
      console.warn('[OMNI] Falha ao recuperar telefone:', e.message);
      return null;
    }
  }

  /**
   * Internal method to record an omnichannel interaction in the database.      
   */
  async _recordInteraction(idpessoa, direcao, conteudo, status, external_id = null) {
    try {
      // USANDO ecoPool para o banco ECOSSISTEMA_ATOMICO (Escrita permitida)    
      await ecoPool.query(`
        INSERT INTO omnichannel_mensagens (idpessoa, direcao, conteudo, status, external_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [idpessoa, direcao, conteudo, status, external_id]);

      // Update last interaction and engagement score in enriched client data   
      const engagementBoost = direcao === 'INBOUND' ? 5.00 : 0.00;

      await ecoPool.query(`
        INSERT INTO clientes_enriquecidos (idpessoa, ultima_interacao, canal_preferido, score_engajamento)
        VALUES ($1, CURRENT_TIMESTAMP, 'WHATSAPP', $2)
        ON CONFLICT (idpessoa) DO UPDATE SET
          ultima_interacao = EXCLUDED.ultima_interacao,
          canal_preferido = EXCLUDED.canal_preferido,
          score_engajamento = LEAST(100.00, clientes_enriquecidos.score_engajamento + EXCLUDED.score_engajamento)
      `, [idpessoa, engagementBoost]);

    } catch (e) {
      console.error('[OMNI] Failed to record interaction:', e.message);
    }
  }

  /**
   * Dispatches a WhatsApp message via the Business API.
   * @param {string} idpessoa - Client ID.
   * @param {string} message - Message body.
   * @param {string} templateId - Optional template ID for HSM.
   * @param {string} overridePhone - Optional sanitized phone to bypass DB lookup.
   */
  async sendWhatsAppMessage(idpessoa, message, templateId = null, overridePhone = null) {
    const enabled = await getConfigValue('omnichannel_whatsapp_enabled', 'false');
    if (enabled !== 'true') return { ok: false, error: 'WhatsApp integration disabled' };

    let phone = overridePhone;
    if (!phone) {
      phone = await this._getClientPhone(idpessoa);
    }

    if (!phone) {
      await logEvent('OMNI_WA_FAIL', idpessoa, 'Telefone invalido ou ausente para envio automatico.');
      return { ok: false, error: 'Telefone invalido' };
    }

    try {
      const apiUrl = await getConfigValue('whatsapp_api_url', '');
      // const apiToken = await getConfigValue('whatsapp_api_token', '');       

      // Simulate API Call Payload
      const payload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: templateId ? 'template' : 'text',
      };

      if (templateId) {
        payload.template = { name: templateId, language: { code: 'pt_BR' } };   
      } else {
        payload.text = { body: message };
      }

      console.log(`[OMNI] Mocking WhatsApp Business API Dispatch to ${phone} (URL: ${apiUrl}): ${message}`);

      // Real implementation would use fetch(apiUrl, { headers: { 'Authorization': `Bearer ${apiToken}` ... } })
      const mockExternalId = `wa_msg_${Date.now()}`;

      // Log success, record interaction and track telemetry
      await logEvent('OMNI_WA_SENT', idpessoa, `Notificacao enviada para ${phone}.`);
      await this._recordInteraction(idpessoa, 'OUTBOUND', message, 'SENT', mockExternalId);
      await trackEvent('whatsapp_api_dispatch', 'system', { idpessoa, phone_prefix: phone.substring(0, 4) });

      return { ok: true, phone, externalId: mockExternalId };
    } catch (e) {
      await logError('OMNI_WA_API', e, idpessoa);
      
      // Proactive Governance: Record the failure in the ERP via PurgeService
      // This allows the ERP to flag the phone as potentially invalid.
      await purgeService.recordWAError(idpessoa, phone, e.message);

      return { ok: false, error: e.message };
    }
  }

  /**
   * Ingests an inbound message from WhatsApp (Webhook endpoint).
   */
  async ingestInboundMessage(idpessoa, content, externalId) {
    console.log(`[OMNI] Ingesting Inbound Message from ${idpessoa}: ${content}`);

    await this._recordInteraction(idpessoa, 'INBOUND', content, 'RECEIVED', externalId);
    await logEvent('OMNI_WA_RECEIVED', idpessoa, 'Mensagem recebida via WhatsApp.');
    await trackEvent('whatsapp_api_inbound', idpessoa, { length: content.length });

    // Try to process as NPS response (Dynamic require to avoid circular dependency)
    try {
      const npsService = require('./npsService');
      await npsService.processResponse(idpessoa, content);
      
      const sentimentService = require('./sentimentService');
      await sentimentService.analyzeMessage(idpessoa, content);
    } catch (e) {
      // Quietly fail if services are not yet fully initialized or error occurs
      console.warn('[OMNI] Could not process NPS or Sentiment response:', e.message);
    }

    return { ok: true };
  }


  /**
   * Domain Logic: Notify client that their registration update was approved.   
   */
  async notifySavApproval(idpessoa, campo, overridePhone = null) {
    const message = `Ola! Seu cadastro no Emporio Natural foi atualizado com sucesso (Campo: ${campo}). Obrigado por comprar conosco!`;
    return this.sendWhatsAppMessage(idpessoa, message, 'sav_update_approved', overridePhone);
  }

  /**
   * Domain Logic: Send a welcome message to a new rep or client.
   * Based on Phase 6 Onboarding Strategy.
   */
  async sendWelcomeMessage(idpessoa, overridePhone = null) {
    const welcomeMsg = await getConfigValue('omni_welcome_message', 'Bem-vindo ao EAV!');
    const guideLink = await getConfigValue('omni_guide_url', 'https://eav.atomico.pc/docs/faq');
    const fullMessage = `${welcomeMsg}\n\nGuia Rápido: ${guideLink}`;

    console.log(`[OMNI] Sending Phase 6 Welcome Message to ${idpessoa}`);
    return this.sendWhatsAppMessage(idpessoa, fullMessage, null, overridePhone);
  }

  /**
   * Domain Logic: Send NPS Survey message (scheduled for 48h after onboarding).
   * Based on Phase 6 Growth Strategy.
   */
  async sendNpsSurvey(idpessoa, overridePhone = null) {
    const surveyMsg = await getConfigValue('omni_nps_message', 'Olá! Você está usando o EAV há 48h. Em uma escala de 0 a 10, o quanto você recomendaria o sistema para um colega?');
    return this.sendWhatsAppMessage(idpessoa, surveyMsg, null, overridePhone);  
  }
}

module.exports = new OmnichannelService();
