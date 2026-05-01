const { pool, ecoPool } = require('../db');
const intel = require('./intelligenceService');
const { isBirthdayToday, daysSince } = require('../utils');
const { logEvent, logError } = require('./logService');

class BulkIntelligenceService {
  async runSweep() {
    console.log('[BULK INTEL] Iniciando varredura de engajamento...');
    let processed = 0;
    try {
      // 1. Fetch active clients and their basic stats from ERP
      const clientsRes = await pool.query(`
        SELECT 
          p.idpessoa, 
          p.dtultimacompra, 
          cr.dtdatanasc,
          COALESCE(f.freq_dias, 0) as freq_dias
        FROM wshop.pessoas p
        LEFT JOIN wshop.crediar cr ON cr.idpessoa = p.idpessoa
        LEFT JOIN LATERAL (
          SELECT 
            CASE WHEN COUNT(*) > 1 THEN
              EXTRACT(DAY FROM (MAX(n.dtemissao) - MIN(n.dtemissao))) / (COUNT(*) - 1)
            ELSE 0 END AS freq_dias
          FROM wshop.documen d
          LEFT JOIN wshop.documento_nfce n ON n.iddocumento = d.iddocumento
          WHERE d.idpessoa = p.idpessoa AND d.tpoperacao = 'V'
            AND (d.stdocumentocancelado IS NULL OR d.stdocumentocancelado != 'S')
        ) f ON TRUE
        WHERE p.stativo = 'S'
      `);
      
      const clients = clientsRes.rows;
      if (!clients.length) return { processed: 0 };

      // 2. Fetch all rankings from ecosystem
      const rankingRes = await ecoPool.query('SELECT idpessoa, abc FROM ranking_cache');
      const rankings = {};
      rankingRes.rows.forEach(r => { rankings[r.idpessoa] = r.abc; });

      // Process in batches to avoid overwhelming the connection/memory
      const batchSize = 500;
      for (let i = 0; i < clients.length; i += batchSize) {
        const batch = clients.slice(i, i + batchSize);
        const updates = [];

        for (const client of batch) {
          const priorityData = {
            idpessoa: client.idpessoa,
            abc: rankings[client.idpessoa] || 'C',
            freq_dias: client.freq_dias || 0,
            aniversario_hoje: isBirthdayToday(client.dtdatanasc),
            dias_sem_compra: daysSince(client.dtultimacompra),
            origem: 'SISTEMA',
            tipo_acao: 'SWEEP',
            criado_em: new Date()
          };

          const score = await intel.calculatePriority(priorityData);
          updates.push({ idpessoa: client.idpessoa, score });
        }

        // Upsert into clientes_enriquecidos
        if (updates.length > 0) {
          try {
            const values = updates.map((_, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2}, NOW())`).join(', ');
            const flatParams = [];
            updates.forEach(u => {
              // Ensure no undefined values enter the params
              flatParams.push(u.idpessoa ?? '0');
              flatParams.push(u.score ?? 0);
            });

            await ecoPool.query(`
              INSERT INTO clientes_enriquecidos (idpessoa, score_engajamento, atualizado_em)
              VALUES ${values}
              ON CONFLICT (idpessoa) DO UPDATE SET 
                score_engajamento = EXCLUDED.score_engajamento,
                atualizado_em = NOW()
            `, flatParams);
          } catch (batchError) {
            const debugParams = updates.flatMap(u => [u.idpessoa, u.score]);
            console.error(`[BULK INTEL] Falha no lote: updates=${updates.length}, flatParams=${debugParams.length}. Erro: ${batchError.message}`);
            throw batchError;
          }
        }

        processed += batch.length;
      }

      console.log(`[BULK INTEL] Varredura concluída. ${processed} clientes atualizados.`);
      await logEvent('INTELLIGENCE_SWEEP', '0', `Varredura concluída. ${processed} clientes atualizados.`);
      return { processed };
    } catch (e) {
      console.error('[BULK INTEL] Erro na varredura:', e.message);
      await logError('INTELLIGENCE_SWEEP', e);
      return { error: e.message };
    }
  }
}

module.exports = new BulkIntelligenceService();