const { ecoPool } = require('../db');
const { logEvent, logError } = require('./logService');
const { trackEvent } = require('./telemetryService');
const { normalizeCorrectionPayload } = require('../utils');

const { isOfflineMode } = require('./healthService');
const { getLocalDb } = require('../localDb');
const intel = require('./intelligenceService');
const notifier = require('./notificationService');

async function saveCorrection(payload, existingClient = null) {
  let client = existingClient;
  let ownsClient = false;
  let idpessoa = '0';
  try {
    const normalized = normalizeCorrectionPayload(payload);
    idpessoa = normalized.idpessoa;

    await trackEvent('SAV_CREATION', normalized.criadoPor || 'auto', {
      idpessoa,
      change_count: normalized.changes.length,
      origem: normalized.origem
    });

    if (await isOfflineMode()) {
      console.log('[CORRECTION] Offline detectado. Buffering no SQLite.');
      const db = getLocalDb();
      const insert = db.prepare(`
        INSERT INTO buffered_corrections (idpessoa, campo, valor_novo, criado_em)
        VALUES (?, ?, ?, datetime('now'))
      `);

      db.transaction(() => {
        for (const change of normalized.changes) {
          insert.run(normalized.idpessoa, change.campo, change.valorNovo);
        }
      })();

      return { ok: true, buffered: true };
    }

    if (!client) {
      client = await ecoPool.connect();
      ownsClient = true;
      await client.query('BEGIN');
    }

    for (const change of normalized.changes) {
      await client.query(`
        INSERT INTO correcoes_campos
          (idpessoa, campo, tabela_origem, valor_original, valor_corrigido, corrigido_por, corrigido_em, sincronizado)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), false)
        ON CONFLICT (idpessoa, campo)
        DO UPDATE SET
          tabela_origem = EXCLUDED.tabela_origem,
          valor_original = EXCLUDED.valor_original,
          valor_corrigido = EXCLUDED.valor_corrigido,
          corrigido_por = EXCLUDED.corrigido_por,
          corrigido_em = NOW(),
          sincronizado = false
      `, [
        normalized.idpessoa,
        change.campo,
        change.tabelaOrigem,
        change.valorOriginal,
        change.valorNovo,
        normalized.criadoPor
      ]);

      if (!change.enfileirar) continue;

      let actionId;
      const updated = await client.query(`
        UPDATE acoes_pendentes
        SET entidade = 'cliente',
            id_entidade = $1,
            nome_pessoa = COALESCE(NULLIF($3, ''), nome_pessoa),
            valor_anterior = $4,
            valor_novo = $5,
            motivo = $6,
            origem = $7,
            criado_por = $8,
            criado_em = NOW(),
            status = 'PENDENTE',
            aprovado_por = NULL,
            aprovado_em = NULL,
            rejeitado_por = NULL,
            rejeitado_em = NULL,
            executado_por = NULL,
            execucao_iniciada_em = NULL,
            executado_em = NULL,
            erro_msg = NULL
        WHERE idpessoa = $1
          AND campo = $2
          AND tipo_acao = 'ALTERAR_CAMPO'
          AND COALESCE(status, 'PENDENTE') = 'PENDENTE'
        RETURNING id
      `, [
        normalized.idpessoa,
        change.campo,
        normalized.nomePessoa,
        change.valorOriginal,
        change.valorNovo,
        normalized.motivo,
        normalized.origem,
        normalized.criadoPor
      ]);

      if (updated.rowCount === 0) {
        const inserted = await client.query(`
          INSERT INTO acoes_pendentes
            (entidade, id_entidade, idpessoa, nome_pessoa, tipo_acao, campo,
             valor_anterior, valor_novo, motivo, origem, criado_por, status)
          VALUES ('cliente', $1, $1, $2, 'ALTERAR_CAMPO', $3, $4, $5, $6, $7, $8, 'PENDENTE')
          RETURNING id
        `, [
          normalized.idpessoa,
          normalized.nomePessoa,
          change.campo,
          change.valorOriginal,
          change.valorNovo,
          normalized.motivo,
          normalized.origem,
          normalized.criadoPor
        ]);
        actionId = inserted.rows[0].id;

        await client.query(`
          INSERT INTO acoes_historico (acao_id, status_anterior, status_novo, usuario, motivo)
          VALUES ($1, NULL, 'PENDENTE', $2, $3)
        `, [actionId, normalized.criadoPor, normalized.motivo]);
      } else {
        actionId = updated.rows[0].id;
        await client.query(`
          INSERT INTO acoes_historico (acao_id, status_anterior, status_novo, usuario, motivo)
          VALUES ($1, 'PENDENTE', 'PENDENTE', $2, $3)
        `, [actionId, normalized.criadoPor, `Pendencia atualizada: ${normalized.motivo}`]);
      }

      // Priority check and notification
      try {
        const priorityScore = await intel.calculatePriority({
          origem: normalized.origem,
          tipo_acao: 'ALTERAR_CAMPO',
          criado_em: new Date(),
          dias_sem_compra: 0, // Simplified for immediate notification
          aniversario_hoje: false
        });

        if (priorityScore >= 80) {
          notifier.notifyCriticalAction({
            nome_pessoa: normalized.nomePessoa,
            campo: change.campo
          });
        }
      } catch (notifyErr) {
        console.warn('[NOTIFY_ERR] Falha ao disparar notificacao:', notifyErr.message);
      }
    }

    if (ownsClient) {
      await client.query('COMMIT');
    }

    for (const change of normalized.changes) {
      await logEvent('CORRECTION_SAVED', normalized.idpessoa, `Campo ${change.campo} corrigido para ${change.valorNovo}`, normalized.criadoPor);
    }
    return { ok: true };
  } catch (e) {
    if (ownsClient && client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Falha ao reverter transacao:', rollbackError.message);
      }
    }
    await logError('CORRECTION', e, idpessoa, payload?.criadoPor || 'sistema');
    return { error: e.message };
  } finally {
    if (ownsClient && client) {
      client.release();
    }
  }
}

module.exports = {
  saveCorrection
};
