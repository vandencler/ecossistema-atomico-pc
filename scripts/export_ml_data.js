const fs = require('fs');
const path = require('path');
const { pool } = require('../src/main/db');

async function exportMlData() {
  console.log('[ML-ETL] Iniciando extracao de dados para treinamento de ML...');
  const outputDir = path.join(process.cwd(), 'ml_data');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const churnFile = path.join(outputDir, 'ml_churn_training.csv');
  const affinityFile = path.join(outputDir, 'ml_affinity_training.csv');
  const transactionFile = path.join(outputDir, 'ml_transactions_basket.csv');

  try {
    // 1. Export Data for Churn Model (RFM + Expanded Features)
    console.log('[ML-ETL] Extraindo base de clientes (RFM+)...');
    const rfmQuery = await pool.query(`
      WITH client_stats AS (
        SELECT 
          p.idpessoa,
          EXTRACT(DAY FROM NOW() - MAX(d.dtemissao)) as recency_days,
          COUNT(DISTINCT d.iddocumento) as frequency,
          COALESCE(SUM(d.vltotal), 0) as monetary_value,
          EXTRACT(DAY FROM NOW() - MIN(d.dtemissao)) as tenure_days,
          AVG(i.qt_items) as avg_basket_size,
          COUNT(DISTINCT pr.idgrupo) as group_diversity
        FROM wshop.pessoas p
        LEFT JOIN wshop.documen d ON p.idpessoa = d.idpessoa
          AND d.tpoperacao = 'V' AND (d.stdocumentocancelado IS NULL OR d.stdocumentocancelado != 'S')
        LEFT JOIN (
          SELECT iddocumento, SUM(qtitem) as qt_items FROM wshop.docitem GROUP BY iddocumento
        ) i ON d.iddocumento = i.iddocumento
        LEFT JOIN wshop.docitem di ON d.iddocumento = di.iddocumento
        LEFT JOIN wshop.produto pr ON di.idproduto = pr.idproduto
        GROUP BY p.idpessoa
      )
      SELECT * FROM client_stats
    `);

    let churnCsv = 'idpessoa,recency_days,frequency,monetary_value,tenure_days,avg_basket_size,group_diversity\n';
    rfmQuery.rows.forEach(r => {
      churnCsv += `${r.idpessoa},${r.recency_days || 999},${r.frequency},${r.monetary_value},${r.tenure_days || 0},${r.avg_basket_size || 0},${r.group_diversity}\n`;
    });
    fs.writeFileSync(churnFile, churnCsv);
    console.log(`[ML-ETL] Salvo RFM+ de ${rfmQuery.rowCount} clientes em ${churnFile}`);

    // 2. Export Data for Affinity Model (Customer-Product totals)
    console.log('[ML-ETL] Extraindo base de itens (Basket)...');
    const basketQuery = await pool.query(`
      SELECT 
        d.idpessoa,
        i.idproduto,
        SUM(i.qtitem) as qtitem
      FROM wshop.documen d
      JOIN wshop.docitem i ON d.iddocumento = i.iddocumento
      WHERE d.tpoperacao = 'V' AND (d.stdocumentocancelado IS NULL OR d.stdocumentocancelado != 'S')
      GROUP BY d.idpessoa, i.idproduto
      HAVING SUM(i.qtitem) > 0
    `);

    let affinityCsv = 'idpessoa,idproduto,qtitem\n';
    basketQuery.rows.forEach(r => {
      affinityCsv += `${r.idpessoa},${r.idproduto},${r.qtitem}\n`;
    });
    fs.writeFileSync(affinityFile, affinityCsv);
    console.log(`[ML-ETL] Salvo ${basketQuery.rowCount} relacionamentos cliente-produto em ${affinityFile}`);

    // 3. Export Transaction Data for Market Basket Analysis (Recent Transactions)
    console.log('[ML-ETL] Extraindo base de transacoes (Basket Analysis)...');
    const transQuery = await pool.query(`
      SELECT 
        iddocumento,
        idproduto,
        dtemissao
      FROM wshop.docitem
      JOIN wshop.documen USING (iddocumento)
      WHERE wshop.documen.tpoperacao = 'V' AND (wshop.documen.stdocumentocancelado IS NULL OR wshop.documen.stdocumentocancelado != 'S')
      AND dtemissao > CURRENT_TIMESTAMP - INTERVAL '180 days'
    `);

    let transCsv = 'iddocumento,idproduto,dtemissao\n';
    transQuery.rows.forEach(r => {
      transCsv += `${r.iddocumento},${r.idproduto},${r.dtemissao ? r.dtemissao.toISOString() : ''}\n`;
    });
    fs.writeFileSync(transactionFile, transCsv);
    console.log(`[ML-ETL] Salvo ${transQuery.rowCount} itens de transacoes em ${transactionFile}`);

    console.log('[ML-ETL] Extracao concluida com sucesso. Pronto para treinamento.');
  } catch (err) {
    console.error('[ML-ETL] Erro fatal durante a extracao:', err.message);
  } finally {
    // In standalone scripts, we don't necessarily need to end pools if we use process.exit
    // but if we do, we must use the .raw property of the wrapper.
    const { pool, ecoPool } = require('../src/main/db');
    if (pool.raw) await pool.raw.end();
    if (ecoPool.raw) await ecoPool.raw.end();
  }
}

exportMlData();
