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
      WHERE COALESCE(status, 'PENDENTE') = $1
      ORDER BY criado_em ASC
      LIMIT 100
    `, [ACTION_STATUS.APPROVED]);

    const items = await Promise.all(pending.rows.map(async (row) => {
      let target;
      try {
        target = resolveSyncTarget(row.campo);
      } catch (error) {
        return { ...row, needsSync: false, blocked: true, error: error.message };
      }

      const mirrorVal = await pool.query(
        `SELECT ${row.campo} FROM ${target.tableName} WHERE idpessoa = $1`,
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
        previewSql: `UPDATE ${target.tableName} SET ${row.campo} = $1 WHERE idpessoa = $2`
      };
    }));

    return {
      totalPending: pending.rowCount,
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
    WHERE id = $1
      AND tipo_acao = 'ALTERAR_CAMPO'
      AND COALESCE(status, 'PENDENTE') = $2
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
        const previewSql = `UPDATE ${target.tableName} SET ${action.campo} = $1 WHERE idpessoa = $2`;

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
            WHERE idpessoa = $1 AND campo = $2
          `, [action.idpessoa, action.campo]);
        });

        syncedCount++;
        results.push({ id: action.id, status: 'SUCCESS', updateOnly: true, targetTable: target.tableName });
        await logEvent('SYNC_SUCCESS', action.idpessoa, `Campo ${action.campo} sincronizado via UPDATE: ${action.valor_novo}`, usuario);
        
        await trackEvent('SYNC_SUCCESS', usuario, {
          idpessoa: action.idpessoa,
          campo: action.campo,
          targetTable: target.tableName
        });
      } catch (e) {
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

module.exports = {
  getSyncStatus,
  performSync,
  
  // Background Worker Logic
  autoSyncTimer: null,
  currentIntervalMs: 0,
  
  async startAutoSync(forceIntervalMs = null) {
    const { getConfigValue } = require('./configService');
    const intervalMinutes = await getConfigValue('auto_sync_interval_minutes', '10');
    const intervalMs = forceIntervalMs || (parseInt(intervalMinutes) * 60000);

    if (this.autoSyncTimer && this.currentIntervalMs === intervalMs) return;
    
    this.stopAutoSync();
    this.currentIntervalMs = intervalMs;
    
    console.log(`[SYNC] Iniciando worker de sincronização automática (${intervalMs}ms)`);
    this.autoSyncTimer = setInterval(async () => {
      try {
        // Step 1: Reconcile offline corrections first
        await reconcileLocalCorrections();

        // Step 2: Normal sync
        const status = await this.getSyncStatus();
        const pending = status.items?.filter(item => item.needsSync);
        if (pending && pending.length > 0) {
          console.log(`[SYNC] Processando ${pending.length} itens automaticamente...`);
          await this.performSync(pending);
        }
        
        // Re-check interval setting in case it changed in DB
        const latestMinutes = await getConfigValue('auto_sync_interval_minutes', '10');
        const latestMs = parseInt(latestMinutes) * 60000;
        if (latestMs !== this.currentIntervalMs) {
          console.log(`[SYNC] Detectada mudança no intervalo: ${this.currentIntervalMs} -> ${latestMs}`);
          this.startAutoSync(latestMs);
        }
      } catch (e) {
        console.error('[SYNC] Erro no worker automático:', e.message);
      }
    }, intervalMs);
  },

  stopAutoSync() {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }
};
