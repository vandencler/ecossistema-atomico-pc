const { pool } = require('../db');
const { logEvent, logError } = require('./logService');
const { trackEvent } = require('./telemetryService');
const { getConfigValue } = require('./configService');

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
    let digits = String(raw).replace(/\D/g, '');
    
    // Remove leading zero from area code (DDD) if present (e.g., 021... -> 21...)
    if (digits.startsWith('0') && digits.length >= 11) {
      digits = digits.substring(1);
    }

    if (digits.length >= 10 && digits.length <= 11) {
      return `55${digits}`;
    } else if (digits.length >= 12 && digits.length <= 13 && digits.startsWith('55')) {
      return digits;
    }
    
    return null;
  }

  /**
   * Retrieves the primary sanitized phone number for a client.
   */
  async _getClientPhone(idpessoa) {
    try {
      const res = await pool.query(`
        SELECT campostelwhatsapp, nrtelefone 
        FROM wshop.pessoas 
        WHERE idpessoa = $1
      `, [idpessoa]);
      
      const p = res.rows[0];
      if (!p) return null;

      const candidates = [p.campostelwhatsapp, p.nrtelefone];
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

      // Log success and track telemetry
      await logEvent('OMNI_WA_SENT', idpessoa, `Notificacao enviada para ${phone}.`);
      await trackEvent('whatsapp_api_dispatch', idpessoa, { phone_prefix: phone.substring(0, 4) });

      return { ok: true, phone };
    } catch (e) {
      await logError('OMNI_WA_API', e, idpessoa);
      return { ok: false, error: e.message };
    }
  }

  /**
   * Domain Logic: Notify client that their registration update was approved.
   */
  async notifySavApproval(idpessoa, campo, overridePhone = null) {
    const message = `Ola! Seu cadastro no Emporio Natural foi atualizado com sucesso (Campo: ${campo}). Obrigado por comprar conosco!`;
    return this.sendWhatsAppMessage(idpessoa, message, 'sav_update_approved', overridePhone);
  }
}

module.exports = new OmnichannelService();