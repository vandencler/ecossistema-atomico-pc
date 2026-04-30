const { pool, ecoPool } = require('../db');
const { FIELD_CONFIG } = require('../utils');
const { logEvent, logError } = require('./logService');

function targetTableFor(campo) {
  const config = FIELD_CONFIG[campo];
  if (!config || config.table === 'ecossistema') return null;
  if (config.table === 'pessoas') return 'wshop.pessoas';
  if (config.table === 'crediar') return 'wshop.crediar';
  return null;
}

async function reconcileCorrections() {
  console.log('[RECONCILE] Iniciando reconciliacao de dados...');
  const results = {
    checked: 0,
    consistent: 0,
    discrepancies: [],
    errors: 0
  };

  try {
    const syncedCorrections = await ecoPool.query(`
      SELECT idpessoa, campo, valor_corrigido, tabela_origem
      FROM correcoes_campos
      WHERE sincronizado = true
    `);

    results.checked = syncedCorrections.rows.length;

    for (const correction of syncedCorrections.rows) {
      try {
        const tableName = targetTableFor(correction.campo);
        if (!tableName) continue;

        const mirrorRes = await pool.query(
          `SELECT ${correction.campo} FROM ${tableName} WHERE idpessoa = $1`,
          [correction.idpessoa]
        );

        const currentMirrorValue = String(mirrorRes.rows[0]?.[correction.campo] ?? '');
        const localValue = String(correction.valor_corrigido ?? '');

        if (currentMirrorValue === localValue) {
          results.consistent++;
          continue;
        }

        results.discrepancies.push({
          idpessoa: correction.idpessoa,
          campo: correction.campo,
          local: localValue,
          mirror: currentMirrorValue
        });

        await ecoPool.query('BEGIN');
        try {
          await ecoPool.query(`
            UPDATE correcoes_campos
            SET sincronizado = false, corrigido_em = NOW()
            WHERE idpessoa = $1 AND campo = $2
          `, [correction.idpessoa, correction.campo]);

          await ecoPool.query(`
            INSERT INTO acoes_pendentes
              (entidade, id_entidade, idpessoa, campo, valor_anterior, valor_novo, motivo, origem, criado_por, status)
            VALUES ('cliente', $1, $1, $2, $3, $4, 'Divergencia detectada na reconciliacao', 'SISTEMA_RECONCILE', 'sistema', 'PENDENTE')
            ON CONFLICT (idpessoa, campo) WHERE status = 'PENDENTE' DO UPDATE SET
              entidade = 'cliente',
              id_entidade = EXCLUDED.id_entidade,
              valor_anterior = EXCLUDED.valor_anterior,
              valor_novo = EXCLUDED.valor_novo,
              motivo = EXCLUDED.motivo,
              origem = EXCLUDED.origem,
              criado_em = NOW(),
              erro_msg = NULL
          `, [correction.idpessoa, correction.campo, currentMirrorValue, localValue]);

          await ecoPool.query('COMMIT');
        } catch (txError) {
          await ecoPool.query('ROLLBACK');
          throw txError;
        }

        await logEvent(
          'RECONCILE_DISCREPANCY',
          correction.idpessoa,
          `Divergencia detectada no campo ${correction.campo}. Local: ${localValue}, Mirror: ${currentMirrorValue}`
        );
      } catch (e) {
        results.errors++;
        console.error(`[RECONCILE] Erro ao verificar ${correction.idpessoa}/${correction.campo}:`, e.message);
      }
    }

    if (results.discrepancies.length > 0) {
      await logEvent(
        'RECONCILE_SUMMARY',
        '0',
        `Reconciliacao concluida. ${results.discrepancies.length} divergencias encontradas e marcadas para re-sincronia.`
      );
    }

    return results;
  } catch (e) {
    await logError('RECONCILE', e);
    throw e;
  }
}

module.exports = { reconcileCorrections };
