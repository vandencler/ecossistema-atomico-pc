const fs = require('fs');
const path = require('path');
const { ecoPool } = require('../src/main/db');

const transFile = path.join(process.cwd(), 'ml_data', 'ml_transactions_basket.csv');

async function analyzeTrendingProducts() {
  if (!fs.existsSync(transFile)) {
    console.log('[ML-TREND] Arquivo de transacoes nao encontrado.');
    return;
  }

  console.log('[ML-TREND] Analisando produtos em tendencia (Trending)...');     
  const data = fs.readFileSync(transFile, 'utf8').split('\n').filter(Boolean).slice(1);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));   

  const recentCounts = {}; // Last 30 days
  const legacyCounts = {}; // 30-180 days ago

  for (const row of data) {
    const [iddoc, idprod, dtemissao] = row.split(',');
    if (!idprod || !dtemissao) continue;

    const date = new Date(dtemissao);
    if (date > thirtyDaysAgo) {
      recentCounts[idprod] = (recentCounts[idprod] || 0) + 1;
    } else {
      legacyCounts[idprod] = (legacyCounts[idprod] || 0) + 1;
    }
  }

  const trending = [];
  for (const idprod in recentCounts) {
    const recent = recentCounts[idprod];
    const legacy = legacyCounts[idprod] || 0;

    // Growth score: (recent / (legacy/5 + 1))
    // We divide legacy by 5 because it covers 150 days vs 30 days
    const legacyNormalized = legacy / 5;
    const growth = recent / (legacyNormalized + 1);

    if (recent > 10 && growth > 1.5) {
      trending.push({ idprod, growth, recent });
    }
  }

  trending.sort((a, b) => b.growth - a.growth);
  console.log(`[ML-TREND] Encontrados ${trending.length} produtos em tendencia.`);

  // Ingest into a new table or use for global recommendations
  const client = await ecoPool.raw.connect();
  try {
    await client.query('BEGIN');

    const trendingJson = JSON.stringify(trending.slice(0, 10));
    await client.query(`
      INSERT INTO config_sistema (chave, valor, atualizado_em)
      VALUES ('TRENDING_PRODUCTS', $1, CURRENT_TIMESTAMP)
      ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = NOW()
    `, [trendingJson]);

    await client.query('COMMIT');
    console.log('[ML-TREND] Top 10 produtos em tendencia salvos em config_sistema.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[ML-TREND] Erro ao salvar tendencias:', e.message);
  } finally {
    client.release();
  }
}

async function run() {
  await analyzeTrendingProducts();
  process.exit(0);
}

run();
