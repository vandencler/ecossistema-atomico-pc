const { ecoPool } = require('../src/main/db');
const fs = require('fs');
const path = require('path');

async function generateFullLookalikeList() {
  console.log('[CAMPAIGN] Generating FULL Lookalike list for Sorocaba...');
  try {
    const res = await ecoPool.query(`
      SELECT 
        p.idpessoa,
        p.cidade,
        p.uf,
        c.risk_score,
        c.confidence,
        r.abc,
        ma.idproduto as recommended_product,
        ma.pitch,
        ma.reason_code
      FROM ml_client_profiles p
      JOIN ml_churn_risk c ON p.idpessoa = c.idpessoa
      LEFT JOIN ranking_cache r ON p.idpessoa = r.idpessoa
      JOIN (
        SELECT idpessoa, idproduto, pitch, reason_code,
               ROW_NUMBER() OVER (PARTITION BY idpessoa ORDER BY affinity_score DESC) as rn
        FROM ml_product_affinity
        WHERE reason_code LIKE 'LOOKALAKE%'
      ) ma ON ma.idpessoa = p.idpessoa AND ma.rn = 1
      WHERE UPPER(p.cidade) = 'SOROCABA'
      ORDER BY CAST(c.risk_score AS numeric) DESC, r.total_compras DESC NULLS LAST
    `);

    if (res.rowCount === 0) {
      console.log('[CAMPAIGN] No lookalikes found for Sorocaba.');
      return;
    }

    const outputDir = path.join(process.cwd(), 'ml_data', 'campaigns');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const filePath = path.join(outputDir, 'sorocaba_lookalike_full_v1.2.csv');
    let csv = 'idpessoa,cidade,uf,risk_score,confidence,abc,recommended_product,reason,pitch\n';
    res.rows.forEach(r => {
      csv += `${r.idpessoa},"${r.cidade}",${r.uf},${r.risk_score},${r.confidence},${r.abc || ''},${r.recommended_product || ''},${r.reason_code},"${r.pitch || ''}"\n`;
    });

    fs.writeFileSync(filePath, csv);
    console.log(`[CAMPAIGN] Saved ${res.rowCount} lookalikes to ${filePath}`);
  } catch (err) {
    console.error('[CAMPAIGN] Error:', err.message);
  } finally {
    process.exit(0);
  }
}

generateFullLookalikeList();
