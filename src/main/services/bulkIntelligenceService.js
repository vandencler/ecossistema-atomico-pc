const { pool, ecoPool } = require('../db');
const intel = require('./intelligenceService');
const { isBirthdayToday, daysSince } = require('../utils');
const { logEvent, logError } = require('./logService');
const { getLastHealth } = require('./healthService');

class BulkIntelligenceService {
  async runSweep() {
    console.log('[BULK INTEL] Iniciando varredura de engajamento...');
    let processed = 0;

    const health = await getLastHealth();
    const can = health.databases.mirror?.accessibleTables || {};

    try {
      // 0. Pre-calculate Ranking Cache
      if (can.documen) {
        console.log('[BULK INTEL] Atualizando cache de ranking...');
        try {
          const rankingData = await pool.query(`
            WITH totais AS (
              SELECT d.idpessoa, SUM(d.vltotal) AS total
              FROM wshop.documen d
              WHERE d.tpoperacao = 'V'
                AND (d.stdocumentocancelado IS NULL OR d.stdocumentocancelado != 'S')
              GROUP BY d.idpessoa
            ),
            ranked AS (
              SELECT idpessoa, total,
                     ROW_NUMBER() OVER (ORDER BY total DESC) AS posicao,
                     COUNT(*) OVER () AS total_clientes
            FROM totais WHERE total > 0
          )
          SELECT idpessoa, posicao, total_clientes, total,
                 CASE
                   WHEN posicao <= total_clientes * 0.2 THEN 'A'
                   WHEN posicao <= total_clientes * 0.5 THEN 'B'
                   ELSE 'C'
                 END AS abc
          FROM ranked
          `);

          if (rankingData.rows.length > 0) {
            // Insert into ranking_cache in batches
            const rBatchSize = 100;
            for (let i = 0; i < rankingData.rows.length; i += rBatchSize) {
              const batch = rankingData.rows.slice(i, i + rBatchSize);
              const values = batch.map((_, idx) => `($${idx * 5 + 1}::text, $${idx * 5 + 2}::integer, $${idx * 5 + 3}::integer, $${idx * 5 + 4}::numeric, $${idx * 5 + 5}::text, NOW())`).join(', ');
              const flatParams = batch.flatMap(r => [
                String(r.idpessoa), 
                parseInt(r.posicao), 
                parseInt(r.total_clientes), 
                parseFloat(r.total), 
                String(r.abc)
              ]);

              await ecoPool.query(`
                INSERT INTO ranking_cache (idpessoa, posicao, total_clientes, total_compras, abc, calculado_em)
                VALUES ${values}
                ON CONFLICT (idpessoa) DO UPDATE SET
                  posicao = EXCLUDED.posicao,
                  total_clientes = EXCLUDED.total_clientes,
                  total_compras = EXCLUDED.total_compras,
                  abc = EXCLUDED.abc,
                  calculado_em = NOW()
              `, flatParams);
            }
          }
        } catch (rankErr) {
          console.warn('[BULK INTEL] Falha ao atualizar ranking (provavelmente falta permissão):', rankErr.message);
        }
      } else {
        console.warn('[BULK INTEL] Pulando atualização de ranking: sem acesso a wshop.documen');
      }

      // 1. Fetch active clients
      console.log('[BULK INTEL] Buscando lista de clientes ativos...');
      let clients = [];
      try {
        if (!can.documen) throw new Error('Missing permission for documen');
        const clientsRes = await pool.query(`
          WITH stats AS (
            SELECT
              d.idpessoa,
              CASE WHEN COUNT(*) > 1 THEN
                EXTRACT(DAY FROM (MAX(d.dtemissao) - MIN(d.dtemissao))) / (COUNT(*) - 1)
              ELSE 0 END AS freq_dias
            FROM wshop.documen d
            WHERE d.tpoperacao = 'V'
              AND (d.stdocumentocancelado IS NULL OR d.stdocumentocancelado != 'S')
            GROUP BY d.idpessoa
          )
          SELECT
            p.idpessoa,
            p.dtultimacompra,
            cr.dtdatanasc,
            COALESCE(s.freq_dias, 0) as freq_dias
          FROM wshop.pessoas p
          LEFT JOIN wshop.crediar cr ON cr.idpessoa = p.idpessoa
          LEFT JOIN stats s ON s.idpessoa = p.idpessoa
          WHERE p.stativo = 'S'
        `);
        clients = clientsRes.rows;
      } catch (__clientErr) {
        console.warn('[BULK INTEL] Falha ao buscar estatísticas complexas, tentando lista simples...');
        const simpleRes = await pool.query(`
          SELECT p.idpessoa, p.dtultimacompra, cr.dtdatanasc, 0 as freq_dias
          FROM wshop.pessoas p
          LEFT JOIN wshop.crediar cr ON cr.idpessoa = p.idpessoa
          WHERE p.stativo = 'S'
        `);
        clients = simpleRes.rows;
      }
      if (!clients.length) return { processed: 0 };

      // 2. Fetch all rankings from ecosystem
      const rankingRes = await ecoPool.query('SELECT idpessoa, abc FROM ranking_cache');
      const rankings = {};
      rankingRes.rows.forEach(r => { rankings[r.idpessoa] = r.abc; });

      // Process in batches
      const batchSize = 100;
      for (let i = 0; i < clients.length; i += batchSize) {
        const batch = clients.slice(i, i + batchSize);
        const batchIds = batch.map(c => String(c.idpessoa));
        const updates = [];

        // Pre-fetch all ML, engagement, and profile data for the batch
        const [churnRes, sentimentRes, affinityRes, engagementRes, profileRes] = await Promise.all([
          ecoPool.query('SELECT idpessoa, risk_score, confidence FROM ml_churn_risk WHERE idpessoa = ANY($1::text[])', [batchIds]),
          ecoPool.query('SELECT idpessoa, sentiment_score, sentiment_label FROM ml_client_sentiment WHERE idpessoa = ANY($1::text[])', [batchIds]),
          ecoPool.query(`
            SELECT idpessoa, idproduto, affinity_score, reason_code
            FROM (
              SELECT idpessoa, idproduto, affinity_score, reason_code,
                     ROW_NUMBER() OVER (PARTITION BY idpessoa ORDER BY affinity_score DESC) as rn
              FROM ml_product_affinity
              WHERE idpessoa = ANY($1::text[])
            ) t WHERE rn = 1
          `, [batchIds]),
          ecoPool.query(`
            SELECT 
              idpessoa,
              COUNT(*) FILTER (WHERE direcao = 'INBOUND') as inbound_count,
              COUNT(*) FILTER (WHERE direcao = 'OUTBOUND') as outbound_count
            FROM omnichannel_mensagens
            WHERE idpessoa = ANY($1::text[]) AND criado_em > CURRENT_TIMESTAMP - INTERVAL '7 days'
            GROUP BY idpessoa
          `, [batchIds]),
          ecoPool.query('SELECT * FROM ml_client_profiles WHERE idpessoa = ANY($1::text[])', [batchIds])
        ]);

        const batchChurn = {}; churnRes.rows.forEach(r => batchChurn[r.idpessoa] = r);
        const batchSentiment = {}; sentimentRes.rows.forEach(r => batchSentiment[r.idpessoa] = r);
        const batchAffinity = {}; affinityRes.rows.forEach(r => batchAffinity[r.idpessoa] = [r]);
        const batchEngagement = {}; engagementRes.rows.forEach(r => batchEngagement[r.idpessoa] = r);
        const batchProfiles = {}; profileRes.rows.forEach(r => batchProfiles[r.idpessoa] = r);

        for (const client of batch) {
          const priorityData = {
            idpessoa: client.idpessoa,
            abc: rankings[client.idpessoa] || 'C',
            freq_dias: client.freq_dias || 0,
            aniversario_hoje: isBirthdayToday(client.dtdatanasc),
            dias_sem_compra: daysSince(client.dtultimacompra),
            origem: 'SISTEMA',
            tipo_acao: 'SWEEP',
            criado_em: new Date(),
            mlRisk: batchChurn[client.idpessoa] || null,
            sentiment: batchSentiment[client.idpessoa] || null,
            productAffinity: batchAffinity[client.idpessoa] || [],
            waEngagement: batchEngagement[client.idpessoa] || { inbound_count: 0, outbound_count: 0, last_interaction: null },
            mlProfile: batchProfiles[client.idpessoa] || null
          };

          const score = await intel.calculatePriority(priorityData);
          updates.push({ idpessoa: client.idpessoa, score });
        }

        if (updates.length > 0) {
          const values = updates.map((_, idx) => `($${idx * 2 + 1}::text, $${idx * 2 + 2}::integer, NOW())`).join(', ');
          const flatParams = updates.flatMap(u => [String(u.idpessoa), parseInt(u.score)]);

          await ecoPool.query(`
            INSERT INTO clientes_enriquecidos (idpessoa, score_engajamento, atualizado_em)
            VALUES ${values}
            ON CONFLICT (idpessoa) DO UPDATE SET
              score_engajamento = EXCLUDED.score_engajamento,
              atualizado_em = NOW()
          `, flatParams);
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
