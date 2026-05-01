const fs = require('fs');
const path = require('path');
const { pool } = require('../src/main/db');

async function exportMlData() {
  console.log('[ML-ETL] Iniciando extracao de dados para treinamento de ML...');
  const outputDir = path.join(process.cwd(), 'ml_data');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const churnFile = path.join(outputDir, 'ml_churn_training.csv');
  const affinityFile = path.join(outputDir, 'ml_affinity_training.csv');

  try {
    // 1. Export Data for Churn Model (Recency, Frequency, Monetary - RFM)
    console.log('[ML-ETL] Extraindo base de clientes (RFM)...');
    const rfmQuery = await pool.query(`
      SELECT 
        p.idpessoa,
        EXTRACT(DAY FROM NOW() - MAX(d.dtemissao)) as recency_days,
        COUNT(d.iddocumento) as frequency,
        COALESCE(SUM(d.vltotal), 0) as monetary_value,
        MIN(d.dtemissao) as first_purchase_date
      FROM wshop.pessoas p
      LEFT JOIN wshop.documen d ON p.idpessoa = d.idpessoa
        AND d.tpoperacao = 'V' AND (d.stdocumentocancelado IS NULL OR d.stdocumentocancelado != 'S')
      LEFT JOIN wshop.documento_nfce n ON d.iddocumento = n.iddocumento
      GROUP BY p.idpessoa
    `);

    let churnCsv = 'idpessoa,recency_days,frequency,monetary_value,first_purchase_date\n';
    rfmQuery.rows.forEach(r => {
      churnCsv += `${r.idpessoa},${r.recency_days},${r.frequency},${r.monetary_value},${r.first_purchase_date}\n`;
    });
    fs.writeFileSync(churnFile, churnCsv);
    console.log(`[ML-ETL] Salvo RFM de ${rfmQuery.rowCount} clientes em ${churnFile}`);

    // 2. Export Data for Affinity Model (Market Basket Analysis)
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

    console.log('[ML-ETL] Extracao concluida com sucesso. Pronto para treinamento.');
  } catch (err) {
    console.error('[ML-ETL] Erro fatal durante a extracao:', err.message);
  } finally {
    const { ecoPool } = require('../src/main/db');
    await Promise.allSettled([pool.end(), ecoPool.end()]);
  }
}

exportMlData();