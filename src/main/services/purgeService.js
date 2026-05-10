const { ecoPool, originalPool } = require('../db');
const { logEvent, logError } = require('./logService');
const { trackEvent } = require('./telemetryService');

/**
 * Purge Service
 * Manages governed write-back operations to the Production ERP Database (192.168.2.103).
 * Every write is logged to the 'purge_queue' for audit and verification.
 */
class PurgeService {
  /**
   * Enqueues and executes a production write-back.
   * @param {string} type - Operation type (e.g., 'WAError_WRITEBACK').
   * @param {string} table - Target table in ERP.
   * @param {string} id - Target record ID.
   * @param {Object} payload - Data to be updated.
   * @param {string} usuario - Actor performing the change.
   */
  async executeWriteBack(type, table, id, payload, usuario = 'sistema') {
    let queueId;
    try {
      // 1. Log the intent to the purge_queue (Ecosystem DB)
      const res = await ecoPool.query(`
        INSERT INTO purge_queue (operation_type, target_table, target_id, payload, usuario)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [type, table, id, JSON.stringify(payload), usuario]);
      
      queueId = res.rows[0].id;

      // 2. Execute against the Production ERP (originalPool)
      // We assume the payload contains key-value pairs for UPDATE
      const fields = Object.keys(payload);
      const values = Object.values(payload);
      
      const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
      const sql = `UPDATE ${table} SET ${setClause} WHERE idpessoa = $${fields.length + 1}`;
      
      console.log(`[PURGE] Executing governed write-back (Queue ID: ${queueId}) to ${table}...`);
      
      const updateResult = await originalPool.query(sql, [...values, id]);

      if (updateResult.rowCount === 0) {
        throw new Error(`Record ${id} not found in production table ${table}`);
      }

      // 3. Mark as COMPLETED
      await ecoPool.query(`
        UPDATE purge_queue
        SET status = 'COMPLETED', processado_em = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [queueId]);

      await logEvent('PURGE_SUCCESS', id, `Write-back ${type} completed for queue ${queueId}`, usuario);
      await trackEvent('purge_writeback_success', usuario, { type, table, queueId });

      return { ok: true, queueId };

    } catch (e) {
      const errorMsg = e.message;
      console.error(`[PURGE] Write-back failed for queue ${queueId || 'NEW'}:`, errorMsg);

      if (queueId) {
        await ecoPool.query(`
          UPDATE purge_queue
          SET status = 'ERROR', error_msg = $2, processado_em = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [queueId, errorMsg]);
      }

      await logError('PURGE', e, id);
      await trackEvent('purge_writeback_error', usuario, { type, table, error: errorMsg });

      return { ok: false, error: errorMsg, queueId };
    }
  }

  /**
   * Specialized method for WAError write-back.
   * Example: Marks a phone as invalid in the ERP when WhatsApp API returns a permanent error.
   */
  async recordWAError(idpessoa, phone, errorDetail, usuario = 'omnichannel-service') {
    const payload = {
      // Example ERP field for notes/errors
      // nmlogradouro could be used for testing, but let's assume a generic notes field if we knew it.
      // For verification, we'll use a field we know exists in 'pessoas'.
      obs: `WA_FAIL: ${phone} - ${errorDetail.substring(0, 50)}`
    };

    return this.executeWriteBack('WAError_WRITEBACK', 'wshop.pessoas', idpessoa, payload, usuario);
  }

  /**
   * Normalizes the 9th digit for all phone fields of a person and writes back to ERP.
   * @param {string} idpessoa - Target person ID.
   * @param {Object} currentPhones - Current phone values (usually from Mirror).
   * @param {string} usuario - Actor performing the change.
   */
  async normalize9thDigit(idpessoa, currentPhones, usuario = 'hygiene-service') {
    const { normalizeBrazilianPhone } = require('../utils');
    const payload = {};
    const fields = ['campostelwhatsapp', 'nrtelefone', 'nrpager'];

    for (const field of fields) {
      if (currentPhones[field]) {
        const normalized = normalizeBrazilianPhone(currentPhones[field]);
        // Update if the normalized version is different from the raw version (including non-numeric chars)
        if (normalized && normalized !== String(currentPhones[field])) {
          payload[field] = normalized;
        }
      }
    }

    if (Object.keys(payload).length === 0) {
      return { ok: true, skipped: true };
    }

    return this.executeWriteBack('9TH_DIGIT_NORM', 'wshop.pessoas', idpessoa, payload, usuario);
  }

  /**
   * Retrieves the purge queue for audit purposes.
   */
  async getQueue(limit = 100) {
    const res = await ecoPool.query(`
      SELECT * FROM purge_queue ORDER BY criado_em DESC LIMIT $1
    `, [limit]);
    return res.rows;
  }
}

module.exports = new PurgeService();
