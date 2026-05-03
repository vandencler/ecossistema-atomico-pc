const { pool, ecoPool } = require('../db');
const { logEvent, logError } = require('./logService');
const { trackEvent } = require('./telemetryService');
const { FIELD_CONFIG, isBirthdayToday, daysSince } = require('../utils');
const intel = require('./intelligenceService');
const notifier = require('./notificationService');

const ACTION_STATUS = Object.freeze({
  PENDING: 'PENDENTE',
  APPROVED: 'APROVADO',
  REJECTED: 'REJEITADO',
  EXECUTING: 'EM_EXECUCAO',
  DONE: 'CONCLUIDO',
  ERROR: 'ERRO',
  CANCELED: 'CANCELADO'
});

const ALLOWED_TRANSITIONS = Object.freeze({
  PENDENTE: new Set(['APROVADO', 'REJEITADO', 'CANCELADO']),
  APROVADO: new Set(['PENDENTE', 'EM_EXECUCAO', 'ERRO', 'CANCELADO']),
  REJEITADO: new Set(['PENDENTE']),
  EM_EXECUCAO: new Set(['CONCLUIDO', 'ERRO']),
  ERRO: new Set(['APROVADO', 'CANCELADO']),
  CONCLUIDO: new Set([]),
  CANCELADO: new Set([])
});

function normalizeStatus(value, fallback = ACTION_STATUS.PENDING) {
  const status = String(value || fallback).trim().toUpperCase();
  if (!Object.values(ACTION_STATUS).includes(status)) throw new Error(`Status invalido: ${status}`);
  return status;
}

function normalizeActionId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Acao invalida');
  return id;
}

function normalizeActor(value, fallback = 'gestor-sav') {
  return String(value || fallback).trim().slice(0, 100) || fallback;
}

function normalizeReason(value) {
  return String(value || '').trim().slice(0, 500);
}

function normalizeQueueFilters(filters = {}) {
  const status = String(filters.status || ACTION_STATUS.PENDING).trim().toUpperCase();
  const allowedStatus = status === 'TODOS' ? 'TODOS' : normalizeStatus(status);
  return {
    status: allowedStatus,
    search: String(filters.search || '').trim().toLowerCase().slice(0, 120),
    campo: String(filters.campo || '').trim().slice(0, 80),
    prioridade: String(filters.prioridade || 'todas').trim().toLowerCase(),
    entidade: String(filters.entidade || '').trim().toLowerCase().slice(0, 40),
    limit: Math.min(Math.max(Number(filters.limit) || 100, 1), 300)
  };
}

function transitionAllowed(from, to) {
  return ALLOWED_TRANSITIONS[from]?.has(to) === true;
}

async function logActionHistory(client, { actionId, fromStatus, toStatus, usuario, motivo }) {
  await client.query(`
    INSERT INTO acoes_historico (acao_id, status_anterior, status_novo, usuario, motivo)
    VALUES ($1, $2, $3, $4, NULLIF($5, ''))
  `, [actionId, fromStatus, toStatus, usuario, motivo || '']);
}

function transitionSql(toStatus, actor, reason) {
  if (toStatus === ACTION_STATUS.APPROVED) {
    return {
      sql: `
        status = 'APROVADO',
        aprovado_por = $2,
        aprovado_em = NOW(),
        rejeitado_por = NULL,
        rejeitado_em = NULL,
        erro_msg = NULL
      `,
      params: [actor]
    };
  }
  if (toStatus === ACTION_STATUS.REJECTED) {
    return {
      sql: `
        status = 'REJEITADO',
        rejeitado_por = $2,
        rejeitado_em = NOW(),
        erro_msg = NULLIF($3, '')
      `,
      params: [actor, reason]
    };
  }
  if (toStatus === ACTION_STATUS.PENDING) {
    return {
      sql: `
        status = 'PENDENTE',
        aprovado_por = NULL,
        aprovado_em = NULL,
        rejeitado_por = NULL,
        rejeitado_em = NULL,
        executado_por = NULL,
        execucao_iniciada_em = NULL,
        erro_msg = NULL
      `,
      params: []
    };
  }
  if (toStatus === ACTION_STATUS.EXECUTING) {
    return {
      sql: `
        status = 'EM_EXECUCAO',
        executado_por = $2,
        execucao_iniciada_em = NOW(),
        erro_msg = NULL
      `,
      params: [actor]
    };
  }
  if (toStatus === ACTION_STATUS.DONE) {
    return {
      sql: `
        status = 'CONCLUIDO',
        executado_por = COALESCE(executado_por, $2),
        executado_em = NOW(),
        erro_msg = NULL
      `,
      params: [actor]
    };
  }
  if (toStatus === ACTION_STATUS.ERROR) {
    return {
      sql: `
        status = 'ERRO',
        executado_por = COALESCE(executado_por, $2),
        executado_em = NOW(),
        erro_msg = NULLIF($3, '')
      `,
      params: [actor, reason]
    };
  }
  if (toStatus === ACTION_STATUS.CANCELED) {
    return {
      sql: `
        status = 'CANCELADO',
        executado_em = NOW(),
        erro_msg = NULLIF($2, '')
      `,
      params: [reason]
    };
  }
  throw new Error(`Status de destino invalido: ${toStatus}`);
}

async function transitionAction(client, { id, toStatus, usuario, motivo = '', requireCurrent = null }) {
  const actionId = normalizeActionId(id);
  const status = normalizeStatus(toStatus);
  const actor = normalizeActor(usuario);
  const reason = normalizeReason(motivo);

  const current = await client.query(`
    SELECT id, idpessoa, entidade, id_entidade, campo, valor_novo, status
    FROM acoes_pendentes
    WHERE id = $1
    FOR UPDATE
  `, [actionId]);

  if (current.rowCount === 0) throw new Error('Acao nao encontrada');

  const action = current.rows[0];
  const currentStatus = normalizeStatus(action.status);
  if (requireCurrent && currentStatus !== requireCurrent) {
    throw new Error(`Acao ${actionId} esta com status ${currentStatus}, esperado ${requireCurrent}`);
  }
  if (!transitionAllowed(currentStatus, status)) {
    throw new Error(`Transicao de ${currentStatus} para ${status} nao permitida`);
  }
  if (status === ACTION_STATUS.REJECTED && !reason) {
    throw new Error('Motivo de rejeicao obrigatorio');
  }

  const result = transitionSql(status, actor, reason);
  const params = [actionId, ...result.params];

  await client.query(`
    UPDATE acoes_pendentes
    SET ${result.sql}
    WHERE id = $1
  `, params);

  await logActionHistory(client, {
    actionId,
    fromStatus: currentStatus,
    toStatus: status,
    usuario: actor,
    motivo: reason
  });

  return { ...action, status: status };
}

function priorityBucket(score) {
  if (score >= 80) return 'critica';
  if (score >= 60) return 'alta';
  return 'normal';
}

function priorityReasons(row) {
  const reasons = [];
  if (row.origem === 'MANUAL') reasons.push('Alteracao manual no atendimento');
  if (row.tipo_acao === 'ALTERAR_CAMPO') reasons.push('Correcao de campo cadastral');
  if (row.aniversario_hoje) reasons.push('Cliente aniversariante hoje');
  if (row.dias_sem_compra >= 365) reasons.push('Cliente sem compra ha mais de 1 ano');
  else if (row.dias_sem_compra <= 30) reasons.push('Cliente comprou recentemente');
  if (row.horas_na_fila >= 24) reasons.push(`Na fila ha ${Math.floor(row.horas_na_fila / 24)} dia(s)`);
  if (['nrcgc_cic', 'email', 'campostelwhatsapp', 'nrpager', 'nrtelefone'].includes(row.campo)) {
    reasons.push('Campo sensivel para contato/identificacao');
  }
  return reasons;
}

async function readCurrentValue(row) {
  const config = FIELD_CONFIG[row.campo];
  if (!config || config.table === 'ecossistema') return null;
  const tableName = config.table === 'pessoas' ? 'wshop.pessoas' : config.table === 'crediar' ? 'wshop.crediar' : null;
  if (!tableName) return null;
  const current = await pool.query(
    `SELECT ${row.campo} AS value FROM ${tableName} WHERE idpessoa = $1 LIMIT 1`,
    [row.idpessoa]
  );
  return current.rows[0]?.value ?? null;
}

async function hydrateQueueRows(rows) {
  const ids = [...new Set(rows.map((row) => row.idpessoa).filter(Boolean))];
  let peopleById = new Map();

  if (ids.length > 0) {
    const people = await pool.query(`
      SELECT p.idpessoa, p.nmpessoa, p.nmcurto, p.nrpager, p.nrtelefone,
             p.campostelwhatsapp, p.dtultimacompra, cr.dtdatanasc
      FROM wshop.pessoas p
      LEFT JOIN wshop.crediar cr ON cr.idpessoa = p.idpessoa
      WHERE p.idpessoa = ANY($1::varchar[])
    `, [ids]);
    peopleById = new Map(people.rows.map((person) => [person.idpessoa, person]));
  }

  const hydrated = [];
  for (const row of rows) {
    const person = peopleById.get(row.idpessoa) || {};
    const base = {
      ...row,
      entidade: row.entidade || 'cliente',
      id_entidade: row.id_entidade || row.idpessoa,
      nome_pessoa: row.nome_pessoa || person.nmpessoa || person.nmcurto || 'Cliente sem nome',
      nrpager: person.nrpager || null,
      nrtelefone: person.nrtelefone || null,
      campostelwhatsapp: person.campostelwhatsapp || null,
      dtultimacompra: person.dtultimacompra || null,
      dtdatanasc: person.dtdatanasc || null,
      aniversario_hoje: isBirthdayToday(person.dtdatanasc),
      dias_sem_compra: daysSince(person.dtultimacompra),
      horas_na_fila: Math.max(0, Math.floor((Date.now() - new Date(row.criado_em).getTime()) / 3600000))
    };
    const prioridade_score = await intel.calculatePriority(base);
    const valor_atual = await readCurrentValue(base);
    hydrated.push({
      ...base,
      valor_atual,
      prioridade_score,
      prioridade_bucket: priorityBucket(prioridade_score),
      prioridade_motivos: priorityReasons({ ...base, prioridade_score })
    });
  }

  return hydrated;
}

async function getActionQueue(filters = {}) {
  try {
    const f = normalizeQueueFilters(filters);
    const params = [];
    const where = [];

    if (f.status !== 'TODOS') {
      params.push(f.status);
      where.push(`status = $${params.length}`);
    }
    if (f.campo) {
      params.push(f.campo);
      where.push(`campo = $${params.length}`);
    }
    if (f.entidade) {
      params.push(f.entidade);
      where.push(`LOWER(COALESCE(entidade, 'cliente')) = $${params.length}`);
    }
    if (f.search) {
      params.push(`%${f.search}%`);
      where.push(`(
        LOWER(COALESCE(nome_pessoa, '')) LIKE $${params.length}
        OR LOWER(COALESCE(idpessoa, '')) LIKE $${params.length}
        OR LOWER(COALESCE(id_entidade, '')) LIKE $${params.length}
        OR LOWER(COALESCE(campo, '')) LIKE $${params.length}
      )`);
    }

    params.push(f.limit);
    const limitParam = `$${params.length}`;
    const pending = await ecoPool.query(`
      SELECT id, entidade, COALESCE(id_entidade, idpessoa) AS id_entidade,
             idpessoa, tipo_acao, campo, valor_anterior, valor_novo,
             motivo, origem, criado_por, criado_em, status, nome_pessoa,
             aprovado_por, aprovado_em, rejeitado_por, rejeitado_em,
             executado_por, execucao_iniciada_em, executado_em, erro_msg, lote_id
      FROM acoes_pendentes
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY
        CASE status
          WHEN 'PENDENTE' THEN 1
          WHEN 'APROVADO' THEN 2
          WHEN 'ERRO' THEN 3
          WHEN 'REJEITADO' THEN 4
          WHEN 'CONCLUIDO' THEN 5
          ELSE 9
        END,
        criado_em DESC
      LIMIT ${limitParam}
    `, params);

    let rows = await hydrateQueueRows(pending.rows);
    if (f.prioridade !== 'todas') {
      rows = rows.filter((row) => row.prioridade_bucket === f.prioridade);
    }
    rows.sort((a, b) => b.prioridade_score - a.prioridade_score || new Date(b.criado_em) - new Date(a.criado_em));

    const byStatus = rows.reduce((acc, row) => {
      const status = row.status || ACTION_STATUS.PENDING;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const summary = {
      total: rows.length,
      critica: rows.filter((row) => row.prioridade_bucket === 'critica').length,
      alta: rows.filter((row) => row.prioridade_bucket === 'alta').length,
      byStatus
    };

    return { rows, summary };
  } catch (e) {
    await logError('QUEUE', e);
    return { error: e.message };
  }
}

async function reviewActions(payload = {}) {
  let client;
  let actor = 'gestor-sav';
  try {
    const ids = Array.isArray(payload.ids) ? payload.ids : [payload.id];
    const actionIds = ids.map(normalizeActionId);
    const decision = normalizeStatus(payload.decision);
    actor = normalizeActor(payload.usuario);
    const motivo = normalizeReason(payload.motivo);
    if (!['APROVADO', 'REJEITADO'].includes(decision)) throw new Error('Decisao invalida');
    if (decision === ACTION_STATUS.REJECTED && !motivo) throw new Error('Motivo de rejeicao obrigatorio');

    client = await ecoPool.connect();
    await client.query('BEGIN');

    const results = [];
    const approvedActions = []; // Keep track of what we approved for WhatsApp

    for (const id of actionIds) {
      const action = await transitionAction(client, {
        id,
        toStatus: decision,
        usuario: actor,
        motivo,
        requireCurrent: ACTION_STATUS.PENDING
      });
      results.push({ id, status: action.status });
      if (decision === ACTION_STATUS.APPROVED) {
        approvedActions.push(action);
      }
    }

    await client.query('COMMIT');

    await logEvent(
      decision === ACTION_STATUS.APPROVED ? 'SAV_ACTION_APPROVED' : 'SAV_ACTION_REJECTED',
      '0',
      `${actionIds.length} acao(oes) alteradas para ${decision}${motivo ? `: ${motivo}` : ''}`,
      actor
    );

    await trackEvent('SAV_REVIEW_BATCH', actor, {
      decision,
      count: actionIds.length,
      ids: actionIds
    });

    return { ok: true, status: decision, results };
  } catch (e) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (rollbackError) {
        console.error('Falha ao reverter revisao SAV:', rollbackError.message);
      }
    }
    await logError('SAV_REVIEW', e, '0', actor);
    return { error: e.message };
  } finally {
    if (client) client.release();
  }
}

async function reviewAction(payload) {
  const result = await reviewActions({
    ...payload,
    ids: [payload?.id]
  });
  if (result.error) return result;
  return { ok: true, status: result.status };
}

async function undoActionReview(payload = {}) {
  let client;
  const actor = normalizeActor(payload.usuario);
  try {
    const id = normalizeActionId(payload.id);
    const motivo = normalizeReason(payload.motivo || 'Revisao desfeita pelo gestor');

    client = await ecoPool.connect();
    await client.query('BEGIN');
    const action = await transitionAction(client, {
      id,
      toStatus: ACTION_STATUS.PENDING,
      usuario: actor,
      motivo
    });
    await client.query('COMMIT');
    await logEvent('SAV_ACTION_UNDO', action.idpessoa || '0', `Acao ${id} voltou para PENDENTE`, actor);
    return { ok: true, status: ACTION_STATUS.PENDING };
  } catch (e) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (rollbackError) {
        console.error('Falha ao desfazer revisao SAV:', rollbackError.message);
      }
    }
    await logError('SAV_UNDO', e, '0', actor);
    return { error: e.message };
  } finally {
    if (client) client.release();
  }
}

async function getActionHistory(payload = {}) {
  try {
    const id = normalizeActionId(payload.id);
    const result = await ecoPool.query(`
      SELECT id, acao_id, status_anterior, status_novo, usuario, motivo, criado_em
      FROM acoes_historico
      WHERE acao_id = $1
      ORDER BY criado_em ASC, id ASC
    `, [id]);
    return { rows: result.rows };
  } catch (e) {
    return { error: e.message };
  }
}

async function markActionExecutionStarted(client, id, usuario = 'sistema') {
  return transitionAction(client, {
    id,
    toStatus: ACTION_STATUS.EXECUTING,
    usuario,
    requireCurrent: ACTION_STATUS.APPROVED
  });
}

async function markActionExecutionDone(client, id, usuario = 'sistema') {
  return transitionAction(client, {
    id,
    toStatus: ACTION_STATUS.DONE,
    usuario,
    requireCurrent: ACTION_STATUS.EXECUTING
  });
}

async function markActionExecutionError(client, id, error, usuario = 'sistema') {
  const actionId = normalizeActionId(id);
  const current = await client.query('SELECT status, nome_pessoa FROM acoes_pendentes WHERE id = $1', [actionId]);
  const action = current.rows[0];
  const status = action?.status || ACTION_STATUS.APPROVED;
  const errorMsg = error instanceof Error ? error.message : String(error || '');

  const result = await transitionAction(client, {
    id: actionId,
    toStatus: ACTION_STATUS.ERROR,
    usuario,
    motivo: errorMsg,
    requireCurrent: status === ACTION_STATUS.EXECUTING ? ACTION_STATUS.EXECUTING : ACTION_STATUS.APPROVED
  });

  notifier.notifyExecutionError(action, errorMsg);
  return result;
}

module.exports = {
  ACTION_STATUS,
  getActionQueue,
  getActionHistory,
  reviewAction,
  reviewActions,
  undoActionReview,
  transitionAction,
  markActionExecutionStarted,
  markActionExecutionDone,
  markActionExecutionError
};
