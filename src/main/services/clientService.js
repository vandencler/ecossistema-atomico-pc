const { pool, ecoPool, settings } = require('../db');
const { logError } = require('./logService');
const { trackEvent } = require('./telemetryService');
const { 
  normalizeId, 
  normalizeSearchTokens, 
  FIELD_CONFIG,
  isBirthdayToday,
  daysSince
} = require('../utils');

const { searchLocalCache } = require('./cacheService');
const { isOfflineMode, getIndexMap } = require('./healthService');
const { getLocalDb } = require('../localDb');

const intel = require('./intelligenceService');

async function cacheOfflineData(idpessoa, lastPurchases, topProducts) {
  try {
    const normId = normalizeId(idpessoa, 'idpessoa');
    const db = getLocalDb();

    db.transaction(() => {
      db.prepare('DELETE FROM last_purchases_cache WHERE idpessoa = ?').run(normId);
      db.prepare('DELETE FROM top_products_cache WHERE idpessoa = ?').run(normId);

      const insertPurchase = db.prepare(`
        INSERT INTO last_purchases_cache (
          idpessoa, iddocumento, nrdocumento, vltotal, aldesconto, vldesconto,
          usuario, dsobservacao, dtemissao, nrnotafiscal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const p of lastPurchases) {
        insertPurchase.run(
          normId, p.iddocumento, p.nrdocumento, p.vltotal, p.aldesconto, p.vldesconto,
          p.usuario, p.dsobservacao, p.dtemissao, p.nrnotafiscal
        );
      }

      const insertProduct = db.prepare(`
        INSERT INTO top_products_cache (
          idpessoa, nmproduto, cdchamada, qtd_total, valor_total, vezes_comprado
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const p of topProducts) {
        insertProduct.run(
          normId, p.nmproduto, p.cdchamada, p.qtd_total, p.valor_total, p.vezes_comprado
        );
      }
    })();
  } catch (e) {
    console.error(`[CACHE] Erro ao cachear dados offline para ${idpessoa}:`, e);
  }
}

async function getClientRanking(idpessoa) {
  try {
    if (await isOfflineMode()) return { posicao: '-', abc: '-', total_clientes: 0 };

    // 1. Try ERP native ranking table
    const erpRanking = await pool.query(`
      WITH total AS (
        SELECT COUNT(DISTINCT id_pessoa) AS total_clientes
        FROM wshop.ranking_calculadoloja
      )
      SELECT
        r.nr_ranking AS posicao,
        total.total_clientes,
        r.vl_compras AS total,
        COALESCE(NULLIF(r.st_abc, ''), '-') AS abc
      FROM wshop.ranking_calculadoloja r
      CROSS JOIN total
      WHERE r.id_pessoa = $1
      ORDER BY r.nr_ranking NULLS LAST
      LIMIT 1
    `, [idpessoa]);

    if (erpRanking.rows[0]?.posicao) return erpRanking.rows[0];

    // 2. Try Ecosystem Cache (expires in settings.cacheTTL hours)
    const localCache = await ecoPool.query(`
      SELECT posicao, total_clientes, total_compras AS total, abc
      FROM ranking_cache
      WHERE idpessoa = $1 AND calculado_em > NOW() - (INTERVAL '1 hour' * $2)
    `, [idpessoa, settings.cacheTTL || 24]);

    if (localCache.rows[0]) return localCache.rows[0];

    // 3. Fallback: Heavy calculation
    const ranking = await pool.query(`
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
      SELECT posicao, total_clientes, total,
             CASE
               WHEN posicao <= total_clientes * 0.2 THEN 'A'
               WHEN posicao <= total_clientes * 0.5 THEN 'B'
               ELSE 'C'
             END AS abc
      FROM ranked WHERE idpessoa = $1
    `, [idpessoa]);

    const result = ranking.rows[0] || { posicao: '-', abc: '-', total_clientes: 0, total: 0 };

    // Update Cache if we got a real result
    if (result.posicao !== '-') {
      await ecoPool.query(`
        INSERT INTO ranking_cache (idpessoa, posicao, total_clientes, total_compras, abc, calculado_em)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (idpessoa) DO UPDATE SET
          posicao = EXCLUDED.posicao,
          total_clientes = EXCLUDED.total_clientes,
          total_compras = EXCLUDED.total_compras,
          abc = EXCLUDED.abc,
          calculado_em = NOW()
      `, [idpessoa, result.posicao, result.total_clientes, result.total, result.abc]);
    }

    return result;
  } catch (e) {
    await logError('RANKING', e, idpessoa);
    return { posicao: '-', abc: '-', total_clientes: 0 };
  }
}

async function applyTableNameOverlay(profile, fixes) {
  if (!fixes.idtabela) return;
  const table = await pool.query(
    'SELECT dstabela FROM wshop.tabelaprecos WHERE idtabela = $1 LIMIT 1',
    [fixes.idtabela]
  );
  if (table.rows[0]?.dstabela) profile.tabela_preco = table.rows[0].dstabela;
}

async function searchClient(query) {
  try {
    await trackEvent('CLIENT_SEARCH', 'unknown', { query });

    if (await isOfflineMode()) {
      console.log('[CLIENT] Modo offline detectado. Buscando no cache local.');
      return await searchLocalCache(query);
    }

    const tokens = normalizeSearchTokens(query);
    if (tokens.length === 0) return { rows: [] };

    const indexMap = await getIndexMap();
    const fullQueryParam = `%${query.trim().toLowerCase()}%`;
    const params = [fullQueryParam];
    
    const conditions = tokens.map((token) => {
      const textParam = `%${token}%`;
      const fuzzyParam = token;
      const digitsOnly = token.replace(/\D/g, '');
      const digitParam = digitsOnly.length > 0 ? `%${digitsOnly}%` : '%NOMATCH%';

      const subConditions = [];

      // Sequential parameter indexing per token
      const addParam = (val) => {
        params.push(val);
        return `$${params.length}::text`;
      };

      // 1. Name matches (Indexed)
      if (indexMap['idx_pessoas_nmpessoa_trgm']) {
        subConditions.push(`LOWER(p.nmpessoa) % ${addParam(fuzzyParam)}`);
      } else {
        subConditions.push(`LOWER(p.nmpessoa) LIKE ${addParam(textParam)}`);
      }

      // 2. Short name / Nickname (Indexed)
      if (indexMap['idx_pessoas_nmcurto_trgm']) {
        subConditions.push(`LOWER(p.nmcurto) % ${addParam(fuzzyParam)}`);
        subConditions.push(`LOWER(p.nmfantasia) % ${addParam(fuzzyParam)}`);
      } else {
        subConditions.push(`LOWER(p.nmcurto) LIKE ${addParam(textParam)}`);
        subConditions.push(`LOWER(p.nmfantasia) LIKE ${addParam(textParam)}`);
      }

      // 3. Call code (Indexed)
      if (indexMap['idx_pessoas_cdchamada_trgm']) {
        subConditions.push(`LOWER(p.cdchamada) % ${addParam(fuzzyParam)}`);
      } else {
        subConditions.push(`LOWER(p.cdchamada) LIKE ${addParam(textParam)}`);
      }

      // 4. Document / CNPJ (Indexed)
      if (indexMap['idx_pessoas_nrcgc_cic_trgm']) {
        subConditions.push(`LOWER(p.nrcgc_cic) % ${addParam(fuzzyParam)}`);
      } else {
        subConditions.push(`LOWER(p.nrcgc_cic) LIKE ${addParam(textParam)}`);
      }

      // 5. Phones (Indexed split)
      if (indexMap['idx_pessoas_telwa_trgm'] || indexMap['idx_pessoas_phones_trgm']) {
        subConditions.push(`REGEXP_REPLACE(COALESCE(p.campostelwhatsapp,''), '[^0-9]', '', 'g') % ${addParam(fuzzyParam)}`);
      } else {
        subConditions.push(`REGEXP_REPLACE(COALESCE(p.campostelwhatsapp,''), '[^0-9]', '', 'g') LIKE ${addParam(digitParam)}`);
      }

      if (indexMap['idx_pessoas_phone_trgm'] || indexMap['idx_pessoas_phones_trgm']) {
        subConditions.push(`REGEXP_REPLACE(COALESCE(p.nrtelefone,''), '[^0-9]', '', 'g') % ${addParam(fuzzyParam)}`);
      } else {
        subConditions.push(`REGEXP_REPLACE(COALESCE(p.nrtelefone,''), '[^0-9]', '', 'g') LIKE ${addParam(digitParam)}`);
      }

      // 6. Generic fields (Non-indexed, use LIKE)
      const tp = addParam(textParam);
      subConditions.push(`LOWER(p.nrincrest_rg) LIKE ${tp}`);
      subConditions.push(`LOWER(p.email) LIKE ${tp}`);
      subConditions.push(`LOWER(p.email2) LIKE ${tp}`);
      subConditions.push(`LOWER(p.inscest_pfisica) LIKE ${tp}`);
      subConditions.push(`TO_CHAR(cr.dtdatanasc, 'DD/MM/YYYY') LIKE ${tp}`);

      if (token.length > 2) {
        subConditions.push(`LOWER(COALESCE(p.nmendereco,'')) LIKE ${tp}`);
        subConditions.push(`LOWER(COALESCE(p.nmbairro,'')) LIKE ${tp}`);
        subConditions.push(`LOWER(COALESCE(p.nmcidade,'')) LIKE ${tp}`);
      }

      return `(${subConditions.join(' OR ')})`;
    });

    const queryRaw = query.trim().toLowerCase();
    const queryTrimmed = query.trim();

    params.push(queryRaw);
    const rawIdx = params.length;
    
    params.push(queryTrimmed);
    const trimIdx = params.length;

    const sql = `
      SELECT p.idpessoa, p.cdchamada, p.nmpessoa, p.nmcurto, p.nrcgc_cic,
             p.email, p.nrtelefone, p.nrpager, p.campostelwhatsapp, p.stpessoa,
             p.sttipopessoa, p.stvendedor,
             p.dtcadastro, p.dtultimacompra, p.aldesconto,
             t.dstabela AS tabela_preco,
             cr.dtdatanasc, cr.sexo,
             similarity(LOWER(p.nmpessoa), $${rawIdx}::text) as score
      FROM wshop.pessoas p
      LEFT JOIN wshop.tabelaprecos t ON p.idtabela = t.idtabela
      LEFT JOIN wshop.crediar cr ON cr.idpessoa = p.idpessoa
      WHERE ${conditions.join(' AND ')}
      ORDER BY 
        CASE 
          WHEN p.cdchamada = $${trimIdx}::text THEN 0
          WHEN LOWER(p.nmpessoa) = $${trimIdx}::text THEN 1
          WHEN LOWER(p.nmpessoa) LIKE $1::text THEN 2
          WHEN LOWER(p.nmcurto) LIKE $1::text THEN 3
          ELSE 4 
        END,
        score DESC,
        p.dtultimacompra DESC NULLS LAST
      LIMIT 25
    `;

    const result = await pool.query(sql, params);
    return { rows: result.rows };
  } catch (e) {
    await logError('SEARCH', e);
    return { error: e.message };
  }
}

async function getBirthdayCustomers() {
  try {
    const sql = `
      WITH tz AS (
        SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS local_today
      ),
      base AS (
        SELECT
          p.idpessoa,
          p.nmpessoa,
          p.nmcurto,
          p.nrpager,
          p.nrtelefone,
          p.campostelwhatsapp,
          p.email,
          cr.dtdatanasc::date AS nascimento,
          make_date(
            EXTRACT(YEAR FROM tz.local_today)::int,
            EXTRACT(MONTH FROM cr.dtdatanasc)::int,
            LEAST(
              EXTRACT(DAY FROM cr.dtdatanasc)::int,
              EXTRACT(
                DAY FROM (
                  date_trunc(
                    'month',
                    make_date(
                      EXTRACT(YEAR FROM tz.local_today)::int,
                      EXTRACT(MONTH FROM cr.dtdatanasc)::int,
                      1
                    ) + INTERVAL '1 month'
                  ) - INTERVAL '1 day'
                )
              )::int
            )
          ) AS aniversario_ano
        FROM wshop.pessoas p
        JOIN wshop.crediar cr ON cr.idpessoa = p.idpessoa
        CROSS JOIN tz
        WHERE cr.dtdatanasc IS NOT NULL
      )
      SELECT
        idpessoa,
        nmpessoa,
        nmcurto,
        nrpager,
        nrtelefone,
        campostelwhatsapp,
        email,
        nascimento,
        aniversario_ano,
        CASE
          WHEN aniversario_ano = tz.local_today THEN 'today'
          WHEN aniversario_ano BETWEEN tz.local_today + INTERVAL '1 day'
               AND tz.local_today + INTERVAL '6 days' THEN 'week'
          ELSE 'none'
        END AS bucket
      FROM base
      CROSS JOIN tz
      WHERE aniversario_ano BETWEEN tz.local_today
        AND tz.local_today + INTERVAL '6 days'
      ORDER BY aniversario_ano ASC, nmpessoa ASC
      LIMIT 300
    `;

    const result = await pool.query(sql);
    return { rows: result.rows };
  } catch (e) {
    await logError('BIRTHDAYS', e);
    return { error: e.message };
  }
}

async function getClientDashboard(rawIdPessoa) {
  let idpessoa = '0';
  try {
    idpessoa = normalizeId(rawIdPessoa, 'idpessoa');

    if (await isOfflineMode()) {
      console.log('[DASHBOARD] Operando em modo offline. Buscando dados basicos no cache local.');
      const db = getLocalDb();
      const cached = db.prepare('SELECT * FROM client_cache WHERE idpessoa = ?').get(idpessoa);
      
      if (!cached) return { error: 'Cliente nao encontrado no cache offline.' };
      
      return {
        offline: true,
        profile: {
          idpessoa: cached.idpessoa,
          nmpessoa: cached.nmpessoa,
          nmcurto: cached.nmcurto,
          nrcgc_cic: cached.nrcgc_cic,
          dtultimacompra: cached.dtultimacompra
        },
        lastPurchases: [],
        topProducts: [],
        stats: {},
        paymentChannels: [],
        ranking: { posicao: '-', abc: '-', total_clientes: 0 },
        corrections: {},
        actionStatus: {}
      };
    }

    const [profile, lastPurchases, topProducts, stats, paymentChannels, ranking] = await Promise.all([
      pool.query(`
        SELECT p.*, t.dstabela AS tabela_preco,
               pe.nmendereco AS end2, pe.nmbairro AS bairro2, pe.nmcidade AS cidade2,
               cr.dtdatanasc, cr.sexo, cr.dsnatural
        FROM wshop.pessoas p
        LEFT JOIN wshop.tabelaprecos t ON p.idtabela = t.idtabela
        LEFT JOIN wshop.pessoas_endereco pe ON pe.idpessoa = p.idpessoa AND pe.stprincipal = true
        LEFT JOIN wshop.crediar cr ON cr.idpessoa = p.idpessoa
        WHERE p.idpessoa = $1
      `, [idpessoa]),

      pool.query(`
        SELECT d.iddocumento, d.nrdocumento, d.vltotal, d.aldesconto, d.vldesconto,
               d.usuario, d.dsobservacao,
               n.dtemissao, n.nrnotafiscal
        FROM wshop.documen d
        LEFT JOIN wshop.documento_nfce n ON n.iddocumento = d.iddocumento
        WHERE d.idpessoa = $1 AND d.tpoperacao = 'V'
          AND (d.stdocumentocancelado IS NULL OR d.stdocumentocancelado != 'S')
        ORDER BY n.dtemissao DESC NULLS LAST
        LIMIT 10
      `, [idpessoa]),

      pool.query(`
        SELECT pr.nmproduto, pr.cdchamada,
               SUM(di.qtitem) AS qtd_total,
               SUM(di.vlitem) AS valor_total,
               COUNT(DISTINCT di.iddocumento) AS vezes_comprado
        FROM wshop.docitem di
        JOIN wshop.produto pr ON pr.idproduto = di.idproduto
        JOIN wshop.documen d ON d.iddocumento = di.iddocumento
        WHERE di.idpessoa = $1 AND d.tpoperacao = 'V'
          AND (d.stdocumentocancelado IS NULL OR d.stdocumentocancelado != 'S')
        GROUP BY pr.nmproduto, pr.cdchamada
        ORDER BY valor_total DESC
        LIMIT 10
      `, [idpessoa]),

      pool.query(`
        SELECT
          COUNT(*) AS total_compras,
          COALESCE(SUM(d.vltotal), 0) AS valor_lifetime,
          COALESCE(AVG(d.vltotal), 0) AS ticket_medio,
          MIN(n.dtemissao) AS primeira_compra,
          MAX(n.dtemissao) AS ultima_compra,
          CASE WHEN COUNT(*) > 1 THEN
            EXTRACT(DAY FROM (MAX(n.dtemissao) - MIN(n.dtemissao))) / (COUNT(*) - 1)
          ELSE 0 END AS freq_dias
        FROM wshop.documen d
        LEFT JOIN wshop.documento_nfce n ON n.iddocumento = d.iddocumento
        WHERE d.idpessoa = $1 AND d.tpoperacao = 'V'
          AND (d.stdocumentocancelado IS NULL OR d.stdocumentocancelado != 'S')
      `, [idpessoa]),

      pool.query(`
        SELECT
          CASE
            WHEN t.nmtprecebimento LIKE '%DINHEIRO%' THEN 'Dinheiro'
            WHEN t.nmtprecebimento LIKE '%PIX%' THEN 'PIX'
            WHEN t.nmtprecebimento LIKE '%CC %' OR t.nmtprecebimento LIKE '%CCP %' THEN 'Credito'
            WHEN t.nmtprecebimento LIKE '%CD %' THEN 'Debito'
            WHEN t.nmtprecebimento LIKE '%VC %' THEN 'Voucher'
            WHEN t.nmtprecebimento LIKE '%BOLETO%' THEN 'Boleto'
            WHEN t.nmtprecebimento LIKE '%CREDIARIO%' OR t.nmtprecebimento LIKE '%PRAZO%' THEN 'Prazo'
            ELSE 'Outros'
          END AS canal,
          COUNT(*) AS vezes,
          SUM(m.vlmovimentocaixa) AS valor
        FROM wshop.movcaix m
        JOIN wshop.tprec t ON t.idtprecebimento = m.idtprecebimento
        JOIN wshop.documen d ON d.iddocumento = m.iddocumento
        WHERE d.idpessoa = $1 AND d.tpoperacao = 'V'
          AND (m.sttroco IS NULL OR m.sttroco != 'S')
          AND (m.stdocumentocancelado IS NULL OR d.stdocumentocancelado != 'S')
        GROUP BY 1 ORDER BY valor DESC
      `, [idpessoa]),

      getClientRanking(idpessoa)
    ]);

    // Proactive background caching for offline reporting
    cacheOfflineData(idpessoa, lastPurchases.rows, topProducts.rows).catch(e => 
      console.error('[CACHE] Erro no warm-up do cache background:', e)
    );

    const corrections = await ecoPool.query(
      'SELECT campo, valor_corrigido FROM correcoes_campos WHERE idpessoa = $1',
      [idpessoa]
    );

    const actionStatuses = await ecoPool.query(`
      SELECT DISTINCT ON (campo)
             id, campo, status, criado_em, aprovado_em, rejeitado_em, executado_em, erro_msg
      FROM acoes_pendentes
      WHERE idpessoa = $1
        AND tipo_acao = 'ALTERAR_CAMPO'
      ORDER BY campo, criado_em DESC, id DESC
    `, [idpessoa]);

    const fixes = {};
    corrections.rows.forEach((row) => {
      fixes[row.campo] = row.valor_corrigido;
    });

    const actionStatus = {};
    actionStatuses.rows.forEach((row) => {
      actionStatus[row.campo] = {
        id: row.id,
        status: row.status || 'PENDENTE',
        criado_em: row.criado_em,
        aprovado_em: row.aprovado_em,
        rejeitado_em: row.rejeitado_em,
        executado_em: row.executado_em,
        erro_msg: row.erro_msg
      };
    });

    const p = profile.rows[0] || {};
    Object.keys(FIELD_CONFIG).forEach((field) => {
      if (fixes[field] !== undefined) p[field] = fixes[field];
    });
    await applyTableNameOverlay(p, fixes);

    const s = stats.rows[0] || {};
    const priorityData = {
      idpessoa: idpessoa,
      abc: ranking.abc || 'C',
      freq_dias: s.freq_dias || 0,
      aniversario_hoje: isBirthdayToday(p.dtdatanasc),
      dias_sem_compra: daysSince(p.dtultimacompra),
      origem: 'SISTEMA',
      tipo_acao: 'DASHBOARD',
      criado_em: new Date()
    };
    
    const priorityScore = await intel.calculatePriority(priorityData);
    const insights = await intel.generateInsights(p, s, priorityData);

    return {
      profile: p,
      lastPurchases: lastPurchases.rows,
      topProducts: topProducts.rows,
      stats: s,
      paymentChannels: paymentChannels.rows,
      ranking,
      corrections: fixes,
      actionStatus,
      priority: {
        score: priorityScore,
        insights
      }
    };
  } catch (e) {
    await logError('DASHBOARD', e, idpessoa);
    return { error: e.message };
  }
}

async function getRecommendations(rawIdPessoa) {
  let idpessoa = '0';
  try {
    idpessoa = normalizeId(rawIdPessoa, 'idpessoa');
    
    // 1. Fetch ML Recommendations (Affinity)
    const mlRecs = await intel.getProductRecommendations(idpessoa, 5);
    let mlResults = [];
    
    if (mlRecs.length > 0) {
      const mlIds = mlRecs.map(r => r.idproduto);
      const details = await pool.query(`
        SELECT pr.idproduto, pr.cdchamada, pr.nmproduto, g.nmgrupo
        FROM wshop.produto pr
        LEFT JOIN wshop.grupo g ON g.idgrupo = pr.idgrupo
        WHERE pr.idproduto = ANY($1::varchar[])
      `, [mlIds]);
      
      mlResults = details.rows.map(row => {
        const rec = mlRecs.find(r => r.idproduto === row.idproduto);
        return {
          ...row,
          source: 'ML',
          reason: rec.reason_code,
          affinity: rec.affinity_score
        };
      });
    }

    // 2. Fetch Heuristic Recommendations (Collaborative Filtering)
    const heuristicResult = await pool.query(`
      WITH my_products AS (
        SELECT DISTINCT di.idproduto, pr.idgrupo
        FROM wshop.docitem di
        JOIN wshop.documen d ON d.iddocumento = di.iddocumento
        JOIN wshop.produto pr ON pr.idproduto = di.idproduto
        WHERE di.idpessoa = $1 AND d.tpoperacao = 'V'
          AND (d.stdocumentocancelado IS NULL OR d.stdocumentocancelado != 'S')
      ),
      my_groups AS (
        SELECT idgrupo, COUNT(*) as weight
        FROM my_products
        GROUP BY idgrupo
      ),
      similar_customers AS (
        SELECT DISTINCT di2.idpessoa
        FROM wshop.docitem di2
        JOIN wshop.documen d2 ON d2.iddocumento = di2.iddocumento
        WHERE di2.idproduto IN (SELECT idproduto FROM my_products)
          AND di2.idpessoa != $1 AND d2.tpoperacao = 'V'
          AND (d2.stdocumentocancelado IS NULL OR d2.stdocumentocancelado != 'S')
        LIMIT 100
      )
      SELECT pr.idproduto, pr.cdchamada, pr.nmproduto, g.nmgrupo,
             COUNT(DISTINCT di.idpessoa) AS clientes_similares,
             SUM(di.qtitem) AS qtd_vendida,
             COALESCE(mg.weight, 0) as group_affinity
      FROM wshop.docitem di
      JOIN wshop.produto pr ON pr.idproduto = di.idproduto
      LEFT JOIN wshop.grupo g ON g.idgrupo = pr.idgrupo
      JOIN wshop.documen d ON d.iddocumento = di.iddocumento
      LEFT JOIN my_groups mg ON mg.idgrupo = pr.idgrupo
      WHERE di.idpessoa IN (SELECT idpessoa FROM similar_customers)
        AND di.idproduto NOT IN (SELECT idproduto FROM my_products)
        AND d.tpoperacao = 'V'
        AND (d.stdocumentocancelado IS NULL OR d.stdocumentocancelado != 'S')
      GROUP BY pr.idproduto, pr.cdchamada, pr.nmproduto, g.nmgrupo, mg.weight
      ORDER BY group_affinity DESC, clientes_similares DESC, qtd_vendida DESC
      LIMIT 10
    `, [idpessoa]);

    const heuristicResults = heuristicResult.rows.map(row => ({
      ...row,
      source: 'HEURISTIC',
      reason: 'COMPRADO_POR_CLIENTES_SIMILARES'
    }));

    // 3. Merge Results (Prioritize ML, avoid duplicates)
    const seen = new Set(mlResults.map(r => r.idproduto));
    const merged = [...mlResults];
    
    for (const h of heuristicResults) {
      if (!seen.has(h.idproduto)) {
        merged.push(h);
        seen.add(h.idproduto);
      }
      if (merged.length >= 12) break;
    }

    return { rows: merged };
  } catch (e) {
    await logError('RECOMMENDATIONS', e, idpessoa);
    return { error: e.message };
  }
}

module.exports = {
  searchClient,
  getBirthdayCustomers,
  getClientDashboard,
  getRecommendations
};
