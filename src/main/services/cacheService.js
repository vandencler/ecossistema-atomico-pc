const { pool, ecoPool } = require('../db');
const { getLocalDb } = require('../localDb');
const { logEvent, logError } = require('./logService');

async function syncMLScoresToCache() {
  console.log('[CACHE] Sincronizando scores de ML para cache local...');
  try {
    const db = getLocalDb();

    // 1. Churn Risk
    const churnData = await ecoPool.query(`
      SELECT idpessoa, risk_score, confidence, next_purchase_estimate, model_version
      FROM ml_churn_risk
      WHERE calculado_em > CURRENT_TIMESTAMP - INTERVAL '30 days'
    `);

    const insertChurn = db.prepare(`
      INSERT OR REPLACE INTO ml_churn_risk (
        idpessoa, risk_score, confidence, next_purchase_estimate, model_version
      )
      VALUES (?, ?, ?, ?, ?)
    `);

    // 2. Product Affinity
    const affinityData = await ecoPool.query(`
      SELECT idpessoa, idproduto, affinity_score, reason_code
      FROM ml_product_affinity
      WHERE calculado_em > CURRENT_TIMESTAMP - INTERVAL '30 days'
      ORDER BY affinity_score DESC
      LIMIT 5000
    `);

    const insertAffinity = db.prepare(`
      INSERT OR REPLACE INTO ml_product_affinity (
        idpessoa, idproduto, affinity_score, reason_code
      )
      VALUES (?, ?, ?, ?)
    `);

    // 3. Client Sentiment
    const sentimentData = await ecoPool.query(`
      SELECT idpessoa, sentiment_score, sentiment_label, last_message_at
      FROM ml_client_sentiment
      WHERE calculado_em > CURRENT_TIMESTAMP - INTERVAL '30 days'
    `);

    const insertSentiment = db.prepare(`
      INSERT OR REPLACE INTO ml_client_sentiment (
        idpessoa, sentiment_score, sentiment_label, last_message_at
      )
      VALUES (?, ?, ?, ?)
    `);

    db.transaction(() => {
      for (const row of churnData.rows) {
        insertChurn.run(
          row.idpessoa, 
          row.risk_score, 
          row.confidence, 
          row.next_purchase_estimate instanceof Date ? row.next_purchase_estimate.toISOString().split('T')[0] : row.next_purchase_estimate, 
          row.model_version
        );
      }
      for (const row of affinityData.rows) {
        insertAffinity.run(row.idpessoa, row.idproduto, row.affinity_score, row.reason_code);
      }
      for (const row of sentimentData.rows) {
        insertSentiment.run(
          row.idpessoa,
          row.sentiment_score,
          row.sentiment_label,
          row.last_message_at instanceof Date ? row.last_message_at.toISOString() : row.last_message_at
        );
      }
    })();

    console.log(`[CACHE] ML Sync concluído: ${churnData.rowCount} churn, ${affinityData.rowCount} afinidades, ${sentimentData.rowCount} sentimentos.`);
  } catch (e) {
    console.warn('[CACHE] Falha ao sincronizar ML para cache:', e.message);
  }
}

async function warmUpCache() {
  console.log('[CACHE] Iniciando warm-up do cache local...');
  try {
    const db = getLocalDb();
    
    // Fetch top 1000 active clients with phone numbers
    const topClients = await pool.query(`
      SELECT p.idpessoa, p.nmpessoa, p.nmcurto, p.nrcgc_cic, p.dtultimacompra,
             p.nrtelefone, p.campostelwhatsapp
      FROM wshop.pessoas p
      WHERE p.stpessoa != 'E' -- Exclude inactive if needed
      ORDER BY p.dtultimacompra DESC NULLS LAST
      LIMIT 1000
    `);

    const insert = db.prepare(`
      INSERT OR REPLACE INTO client_cache (
        idpessoa, nmpessoa, nmcurto, nrcgc_cic, dtultimacompra, 
        nrtelefone, campostelwhatsapp
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((clients) => {
      for (const client of clients) {
        insert.run(
          client.idpessoa,
          client.nmpessoa,
          client.nmcurto,
          client.nrcgc_cic,
          client.dtultimacompra ? new Date(client.dtultimacompra).toISOString() : null,
          client.nrtelefone,
          client.campostelwhatsapp
        );
      }
    });

    transaction(topClients.rows);

    // Proactive docitem caching for top clients
    const clientIds = topClients.rows.map(r => r.idpessoa);
    await warmUpTopProductsCache(clientIds);

    // Sync ML Scores too
    await syncMLScoresToCache();

    await logEvent('CACHE_WARMUP', '0', `Cache local populado com ${topClients.rowCount} clientes + ML scores.`);
    console.log(`[CACHE] Warm-up concluído: ${topClients.rowCount} clientes cacheados.`);
  } catch (e) {
    console.error('[CACHE] Erro no warm-up:', e.message);
    await logError('CACHE_WARMUP', e);
  }
}

async function searchLocalCache(query) {
  try {
    const db = getLocalDb();
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return { rows: [] };

    const conditions = tokens.map(() => `(
      LOWER(COALESCE(nmpessoa,'')) LIKE ? OR 
      LOWER(COALESCE(nmcurto,'')) LIKE ? OR 
      LOWER(COALESCE(nrcgc_cic,'')) LIKE ? OR 
      LOWER(COALESCE(nrtelefone,'')) LIKE ? OR 
      LOWER(COALESCE(campostelwhatsapp,'')) LIKE ?
    )`).join(' AND ');
    
    const params = [];
    tokens.forEach(token => {
      const p = `%${token}%`;
      params.push(p, p, p, p, p);
    });

    const queryLower = `%${query.toLowerCase().trim()}%`;

    const rows = db.prepare(`
      SELECT *, 
             (CASE WHEN LOWER(COALESCE(nmpessoa,'')) LIKE ? THEN 10 ELSE 0 END + 
              CASE WHEN LOWER(COALESCE(nmcurto,'')) LIKE ? THEN 5 ELSE 0 END) as score
      FROM client_cache 
      WHERE ${conditions}
      ORDER BY score DESC, nmpessoa ASC
      LIMIT 25
    `).all(queryLower, queryLower, ...params);

    return { rows: rows.map(r => ({ ...r, _source: 'cache' })) };
  } catch (e) {
    console.error('[CACHE] Erro na busca local:', e.message);
    return { error: e.message };
  }
}

async function warmUpTopProductsCache(clientIds) {
  console.log(`[CACHE] Iniciando warm-up de Top Produtos for ${clientIds.length} clientes...`);
  try {
    const db = getLocalDb();
    
    const batchSize = 100;
    for (let i = 0; i < clientIds.length; i += batchSize) {
      const batchIds = clientIds.slice(i, i + batchSize);
      
      const res = await pool.query(`
        SELECT di.idpessoa, pr.nmproduto, pr.cdchamada,
               SUM(di.qtitem) AS qtd_total,
               SUM(di.vlitem) AS valor_total,
               COUNT(DISTINCT di.iddocumento) AS vezes_comprado
        FROM wshop.docitem di
        JOIN wshop.produto pr ON pr.idproduto = di.idproduto
        JOIN wshop.documen d ON d.iddocumento = di.iddocumento
        WHERE di.idpessoa = ANY($1::varchar[]) AND d.tpoperacao = 'V'
          AND (d.stdocumentocancelado IS NULL OR d.stdocumentocancelado != 'S')
        GROUP BY di.idpessoa, pr.nmproduto, pr.cdchamada
        ORDER BY di.idpessoa, valor_total DESC
      `, [batchIds]);

      const insert = db.prepare(`
        INSERT OR REPLACE INTO top_products_cache (
          idpessoa, nmproduto, cdchamada, qtd_total, valor_total, vezes_comprado
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      db.transaction(() => {
        for (const row of res.rows) {
          insert.run(
            row.idpessoa,
            row.nmproduto,
            row.cdchamada,
            row.qtd_total,
            row.valor_total,
            row.vezes_comprado
          );
        }
      })();
    }
  } catch (e) {
    console.warn('[CACHE] Falha no warm-up de Top Produtos:', e.message);
  }
}

module.exports = {
  warmUpCache,
  searchLocalCache
};
