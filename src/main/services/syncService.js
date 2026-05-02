const { pool, ecoPool } = require('../db');
const { logEvent, logError } = require('./logService');
const { trackEvent } = require('./telemetryService');
const { FIELD_CONFIG } = require('../utils');
const {
  ACTION_STATUS,
  markActionExecutionStarted,
  markActionExecutionDone,
  markActionExecutionError
} = require('./savService');

const { getLocalDb } = require('../localDb');

function resolveSyncTarget(campo) {
  const config = FIELD_CONFIG[campo];
  if (!config || config.table === 'ecossistema') {
    throw new Error(`Campo ${campo} nao suporta sincronizacao com ERP`);
  }
  if (config.table === 'pessoas') return { tableName: 'wshop.pessoas', source: config.table };
  if (config.table === 'crediar') return { tableName: 'wshop.crediar', source: config.table };
  throw new Error(`Tabela nao permitida para ${campo}`);
}

function normalizeSyncItems(items) {
  const actions = Array.isArray(items) ? items : [items];
  return actions
    .map((item) => Number(item?.id ?? item))
    .filter((id) => Number.isInteger(id) && id > 0);
}

async function withEcoTransaction(fn) {
  const client = await ecoPool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Falha ao reverter transacao SAV:', rollbackError.message);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function reconcileLocalCorrections() {
  const db = getLocalDb();
  const buffered = db.prepare('SELECT * FROM buffered_corrections WHERE synced = 0').all();
  
  if (buffered.length === 0) return;

  console.log(`[SYNC] Reconciliando ${buffered.length} correções locais...`);
  const { saveCorrection } = require('./correctionService');

  for (const item of buffered) {
    try {
      const result = await saveCorrection({
        idpessoa: item.idpessoa,
        changes: [{ campo: item.campo, valorNovo: item.valor_novo }],
        origem: 'OFFLINE_RECONCILE',
        criadoPor: 'sistema'
      });

      if (result.ok) {
        db.prepare('UPDATE buffered_corrections SET synced = 1 WHERE id = ?').run(item.id);
      }
    } catch (e) {
      console.error(`[SYNC] Erro ao reconciliar item ${item.id}:`, e.message);
    }
  }
}

async function getSyncStatus() {
  try {
    const pending = await ecoPool.query(`
      SELECT id, idpessoa, campo, valor_novo, tipo_acao, nome_pessoa, aprovado_por, aprovado_em
      FROM acoes_pendentes
      WHERE COALESCE(status, 'PENDENTE') = CAST($1 AS text)
      ORDER BY criado_em ASC
      LIMIT 100
    `, [ACTION_STATUS.APPROVED]);

    const readyToExportResult = await ecoPool.query(`
      SELECT COUNT(*) as count 
      FROM acoes_pendentes 
      WHERE status = CAST($1 AS text) AND lote_id IS NULL
    `, [ACTION_STATUS.DONE]);

    const items = await Promise.all(pending.rows.map(async (row) => {
      let target;
      try {
        target = resolveSyncTarget(row.campo);
        
        const mirrorVal = await pool.query(
          `SELECT ${row.campo} FROM ${target.tableName} WHERE idpessoa = CAST($1 AS text)`,
          [row.idpessoa]
        );
        const valorMirror = mirrorVal.rows[0]?.[row.campo];
        
        return {
          id: row.id,
          idpessoa: row.idpessoa,
          nome_pessoa: row.nome_pessoa,
          campo: row.campo,
          tabela_origem: target.source,
          targetTable: target.tableName,
          valorLocal: row.valor_novo,
          valorMirror: valorMirror,
          approvedBy: row.aprovado_por,
          approvedAt: row.aprovado_em,
          needsSync: String(row.valor_novo) !== String(valorMirror ?? ''),
          previewSql: `UPDATE ${target.tableName} SET ${row.campo} = CAST($1 AS text) WHERE idpessoa = CAST($2 AS text)`
        };
      } catch (error) {
        console.warn(`[SYNC] Falha ao verificar status para item ${row.id}: ${error.message}`);
        return { 
          ...row, 
          needsSync: false, 
          blocked: true, 
          error: error.message,
          tabela_origem: 'ERRO',
          targetTable: 'ERRO',
          valorLocal: row.valor_novo,
          valorMirror: '???'
        };
      }
    }));

    return {
      totalPending: pending.rowCount,
      readyToExport: parseInt(readyToExportResult.rows[0].count, 10),
      items
    };
  } catch (e) {
    return { error: e.message };
  }
}

async function loadApprovedAction(id) {
  const result = await ecoPool.query(`
    SELECT id, idpessoa, campo, valor_novo, tipo_acao, nome_pessoa, status
    FROM acoes_pendentes
    WHERE id = $1::integer
      AND tipo_acao = 'ALTERAR_CAMPO'
      AND COALESCE(status, 'PENDENTE') = CAST($2 AS text)
    LIMIT 1
  `, [id, ACTION_STATUS.APPROVED]);
  if (result.rowCount === 0) throw new Error(`Acao ${id} nao esta aprovada para sincronizacao`);
  return result.rows[0];
}

async function performSync(items, options = {}) {
  let syncedCount = 0;
  const results = [];
  const actionIds = normalizeSyncItems(items);
  const dryRun = options.dryRun === true;
  const usuario = String(options.usuario || 'sync-service').trim().slice(0, 100) || 'sync-service';

  if (actionIds.length === 0) return { ok: true, syncedCount: 0, results: [] };

  let mirrorClient;

  try {
    mirrorClient = await pool.connect();

    for (const id of actionIds) {
      let action = { id };
      try {
        action = await loadApprovedAction(id);
        const target = resolveSyncTarget(action.campo);
        const previewSql = `UPDATE ${target.tableName} SET ${action.campo} = CAST($1 AS text) WHERE idpessoa = CAST($2 AS text)`;

        if (dryRun) {
          results.push({
            id: action.id,
            status: 'PREVIEW',
            sql: previewSql,
            params: ['<valor_novo>', '<idpessoa>'],
            targetTable: target.tableName
          });
          continue;
        }

        await withEcoTransaction((client) => markActionExecutionStarted(client, action.id, usuario));

        const updateResult = await mirrorClient.query(
          previewSql,
          [action.valor_novo, action.idpessoa]
        );
        if (updateResult.rowCount === 0) {
          throw new Error(`Registro ${action.idpessoa} nao encontrado em ${target.tableName}`);
        }

        await withEcoTransaction(async (client) => {
          await markActionExecutionDone(client, action.id, usuario);
          await client.query(`
            UPDATE correcoes_campos
            SET sincronizado = true
            WHERE idpessoa = CAST($1 AS text) AND campo = CAST($2 AS text)
          `, [action.idpessoa, action.campo]);
        });

        // TRIGGER OMNICHANNEL NOTIFICATION
        const omnichannel = require('./omnichannelService');
        let overridePhone = null;
        if (['campostelwhatsapp', 'nrtelefone'].includes(action.campo)) {
          overridePhone = omnichannel.sanitizePhone(action.valor_novo);
        }
        
        const validPhone = overridePhone || await omnichannel._getClientPhone(action.idpessoa);
        if (validPhone) {
          omnichannel.notifySavApproval(action.idpessoa, action.campo, overridePhone).catch(err => {
            console.error(`[SYNC] Falha ao disparar notificacao WhatsApp para ID ${action.id}:`, err.message);
          });
        }

        syncedCount++;
        results.push({ id: action.id, status: 'SUCCESS', updateOnly: true, targetTable: target.tableName });
        await logEvent('SYNC_SUCCESS', action.idpessoa, `Campo ${action.campo} sincronizado via UPDATE: ${action.valor_novo}`, usuario);
        
        await trackEvent('SYNC_SUCCESS', usuario, {
          idpessoa: action.idpessoa,
          campo: action.campo,
          targetTable: target.tableName
        });
      } catch (e) {
        const isPermissionError = e.code === '42501' || String(e.message).toLowerCase().includes('permission denied');
        
        if (isPermissionError) {
          console.warn(`[SYNC] Permission denied for action ${action.id} (Client: ${action.idpessoa}). Skipping...`);
          results.push({ id: action.id, status: 'PERMISSION_DENIED', error: e.message });
          continue;
        }

        try {
          await withEcoTransaction((client) => markActionExecutionError(client, action.id, e, usuario));
        } catch (logErrorMsg) {
          console.error('[CRITICAL] Failed to update action status in local DB:', logErrorMsg.message);
        }
        
        await logError('SYNC', e, action.idpessoa);
        results.push({ id: action.id, status: 'ERROR', error: e.message });
        
        await trackEvent('SYNC_ERROR', usuario, {
          idpessoa: action.idpessoa,
          error: e.message
        });
      }
    }

    return { ok: true, syncedCount, results };
  } catch (e) {
    return { error: e.message };
  } finally {
    if (mirrorClient) mirrorClient.release();
  }
}

async function generateBatchScript() {
  try {
    const ready = await ecoPool.query(`
      SELECT id, idpessoa, campo, valor_novo, nome_pessoa, status
      FROM acoes_pendentes
      WHERE status = CAST($1 AS text) AND lote_id IS NULL
      ORDER BY criado_em ASC
    `, [ACTION_STATUS.DONE]);

    if (ready.rowCount === 0) return { ok: true, sql: '-- Nenhum item sincronizado pendente de exportacao ERP.' };

    let sql = `-- Lote de Correcao SAV - Gerado em ${new Date().toLocaleString()}\n`;
    sql += `-- Total de itens: ${ready.rowCount}\n\n`;
    sql += 'BEGIN;\n\n';

    const ids = [];
    for (const row of ready.rows) {
      try {
        const target = resolveSyncTarget(row.campo);
        sql += `-- [Status: ${row.status}] Cliente: ${row.nome_pessoa} (${row.idpessoa})\n`;
        sql += `UPDATE ${target.tableName} SET ${row.campo} = '${String(row.valor_novo).replace(/'/g, "''")}' WHERE idpessoa = '${row.idpessoa}';\n\n`;
        ids.push(row.id);
      } catch (e) {
        sql += `-- ERRO no item ${row.id}: ${e.message}\n\n`;
      }
    }

    sql += 'COMMIT;\n';

    return { ok: true, sql, ids };
  } catch (e) {
    return { error: e.message };
  }
}

async function markBatchAsExported(ids) {
  if (!ids || ids.length === 0) return null;
  
  const res = await ecoPool.query(`
    INSERT INTO lotes_execucao (executado_por, total_acoes, observacoes)
    VALUES (CAST($1 AS text), $2::integer, CAST($3 AS text))
    RETURNING id
  `, ['sistema-batch-export', ids.length, `Lote gerado para exportação ERP em ${new Date().toLocaleString()}`]);
  
  const loteId = res.rows[0].id;
  await ecoPool.query('UPDATE acoes_pendentes SET lote_id = $1::integer WHERE id = ANY($2::int[])', [loteId, ids]);
  return loteId;
}

let autoSyncTimer = null;
let currentIntervalMs = 0;

async function startAutoSync(forceIntervalMs = null) {
  const { getConfigValue } = require('./configService');
  const intervalMinutes = await getConfigValue('auto_sync_interval_minutes', '10');
  const intervalMs = forceIntervalMs || (parseInt(intervalMinutes) * 60000);

  if (autoSyncTimer && currentIntervalMs === intervalMs) return;
  
  stopAutoSync();
  currentIntervalMs = intervalMs;
  
  console.log(`[SYNC] Iniciando worker de sincronização automática (${intervalMs}ms)`);
  
  const run = async () => {
    try {
      await reconcileLocalCorrections();
      const status = await getSyncStatus();
      const pending = status.items?.filter(item => item.needsSync);
      if (pending && pending.length > 0) {
        console.log(`[SYNC] Processando ${pending.length} itens automaticamente...`);
        await performSync(pending);
      }
    } catch (e) {
      console.error('[SYNC] Erro no worker automático:', e.message);
    } finally {
      const latestMinutes = await getConfigValue('auto_sync_interval_minutes', '10');
      const latestMs = parseInt(latestMinutes) * 60000;
      
      if (latestMs !== currentIntervalMs) {
        currentIntervalMs = latestMs;
      }
      
      if (currentIntervalMs > 0) {
        autoSyncTimer = setTimeout(run, currentIntervalMs);
      }
    }
  };

  run();
}

function stopAutoSync() {
  if (autoSyncTimer) {
    clearTimeout(autoSyncTimer);
    autoSyncTimer = null;
  }
}

async function setupRealTimeListener() {
  try {
    const client = await ecoPool.connect();
    await client.query('LISTEN sav_approved');
    console.log('[SYNC] Escutando eventos em tempo real (sav_approved)...');

    client.on('notification', async (msg) => {
      if (msg.channel === 'sav_approved') {
        const actionId = parseInt(msg.payload, 10);
        console.log(`[SYNC] Evento de aprovacao recebido em tempo real para ID: ${actionId}`);
        try {
          await performSync([actionId], { usuario: 'sistema-realtime' });
        } catch (err) {
          console.error(`[SYNC] Falha na sincronizacao em tempo real do ID ${actionId}:`, err.message);
        }
      }
    });

    client.on('error', (err) => {
      console.error('[SYNC] Erro no listener em tempo real:', err.message);
      client.release(err);
      setTimeout(() => setupRealTimeListener(), 5000);
    });

  } catch (e) {
    console.error('[SYNC] Falha ao configurar listener em tempo real:', e.message);
  }
}

module.exports = {
  getSyncStatus,
  performSync,
  generateBatchScript,
  markBatchAsExported,
  startAutoSync,
  stopAutoSync,
  setupRealTimeListener
};
