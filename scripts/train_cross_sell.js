
const cwd = process.cwd();
if (!cwd.toLowerCase().includes("-pc")) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error("This script MUST be executed from D:\projetos\ecossistema-atomico-pc");
    process.exit(1);
}

const fs = require('fs');
const path = require('path');
const { ecoPool } = require('../src/main/db');

const outputDir = path.join(process.cwd(), 'ml_data');
const transFile = path.join(outputDir, 'ml_transactions_basket.csv');
const affinityFile = path.join(outputDir, 'ml_affinity_training.csv');

async function trainCrossSellRules() {
  if (!fs.existsSync(transFile)) {
    console.log('[ML-CROSS] Arquivo de transacoes nao encontrado.');
    return;
  }

  console.log('[ML-CROSS] Treinando regras de Cross-sell (Bought Together)...');
  const transData = fs.readFileSync(transFile, 'utf8').split('\n').filter(Boolean).slice(1);
  
  const productCounts = {}; // { idproduto: count }
  const pairCounts = {};    // { idprodutoA: { idprodutoB: count } }
  const baskets = {};       // { iddocumento: [idproduto] }

  console.log(`[ML-CROSS] Lendo ${transData.length} itens de transacao...`);
  for (const row of transData) {
    const [iddoc, idprod] = row.split(',');
    if (!iddoc || !idprod) continue;
    
    productCounts[idprod] = (productCounts[idprod] || 0) + 1;
    if (!baskets[iddoc]) baskets[iddoc] = [];
    baskets[iddoc].push(idprod);
  }

  console.log(`[ML-CROSS] Calculando pares em ${Object.keys(baskets).length} cestas...`);
  for (const iddoc in baskets) {
    const items = baskets[iddoc];
    if (items.length < 2) continue;
    
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        
        if (!pairCounts[a]) pairCounts[a] = {};
        pairCounts[a][b] = (pairCounts[a][b] || 0) + 1;
        
        if (!pairCounts[b]) pairCounts[b] = {};
        pairCounts[b][a] = (pairCounts[b][a] || 0) + 1;
      }
    }
  }

  const totalBaskets = Object.keys(baskets).length;
  const rules = []; // { a, b, confidence, lift }
  console.log('[ML-CROSS] Filtrando regras de alta confianca e lift...');
  for (const a in pairCounts) {
    for (const b in pairCounts[a]) {
      const countAB = pairCounts[a][b];
      const countA = productCounts[a];
      const countB = productCounts[b];
      
      const confidence = (countAB / countA) * 100;
      const supportB = countB / totalBaskets;
      const lift = (confidence / 100) / supportB;
      
      // Thresholds: Min 5 pairs, 15% confidence, and Lift > 1.2 (meaning B is more likely bought with A than overall)
      if (countAB > 5 && confidence > 15 && lift > 1.2) {
        rules.push({ a, b, confidence, lift });
      }
    }
  }

  rules.sort((x, y) => (y.confidence * y.lift) - (x.confidence * x.lift));
  console.log(`[ML-CROSS] Encontradas ${rules.length} regras validas (Lift > 1.2).`);

  // Now apply rules to clients
  console.log('[ML-CROSS] Aplicando regras aos perfis de clientes...');
  const affinityData = fs.readFileSync(affinityFile, 'utf8').split('\n').filter(Boolean).slice(1);
  const clientPurchases = {}; // { idpessoa: Set(idproduto) }
  
  for (const row of affinityData) {
    const [idp, idprod] = row.split(',');
    if (!clientPurchases[idp]) clientPurchases[idp] = new Set();
    clientPurchases[idp].add(idprod);
  }

  // Load Gender Bias
  const biasPath = path.join(process.cwd(), 'ml_data', 'product_gender_bias.json');
  const productBias = fs.existsSync(biasPath) ? JSON.parse(fs.readFileSync(biasPath, 'utf8')) : {};

  const client = await ecoPool.raw.connect();
  try {
    // Fetch client genders
    const profileRes = await client.query('SELECT idpessoa, sexo FROM ml_client_profiles');
    const clientGenders = {};
    profileRes.rows.forEach(r => clientGenders[r.idpessoa] = r.sexo);

    await client.query('BEGIN');
    let recCount = 0;

    for (const idp in clientPurchases) {
      const bought = clientPurchases[idp];
      const gender = clientGenders[idp];
      const recs = {}; // { idprod_rec: max_weighted_score }

      for (const idprod of bought) {
        // Find rules for this product
        const productRules = rules.filter(r => r.a === idprod);
        for (const rule of productRules) {
          if (!bought.has(rule.b)) {
            // GENDER FILTER
            const bias = productBias[rule.b];
            if (bias && gender && bias !== gender) {
              continue; // Skip recommendation if it has strong bias for opposite gender
            }

            const weight = (rule.confidence / 100) * Math.log(rule.lift + 1);
            recs[rule.b] = Math.max(recs[rule.b] || 0, weight);
          }
        }
      }

      // Insert top 3 recommendations per client
      const topRecs = Object.entries(recs)
        .sort((x, y) => y[1] - x[1])
        .slice(0, 3);

      for (const [idprod_rec, weight] of topRecs) {
        const finalScore = Math.min(98, weight * 100);
        await client.query(`
          INSERT INTO ml_product_affinity (idpessoa, idproduto, affinity_score, reason_code, pitch)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (idpessoa, idproduto) DO UPDATE SET
            affinity_score = GREATEST(ml_product_affinity.affinity_score, EXCLUDED.affinity_score),
            reason_code = CASE WHEN EXCLUDED.affinity_score > ml_product_affinity.affinity_score THEN EXCLUDED.reason_code ELSE ml_product_affinity.reason_code END,
            pitch = CASE WHEN EXCLUDED.affinity_score > ml_product_affinity.affinity_score OR ml_product_affinity.pitch IS NULL THEN EXCLUDED.pitch ELSE ml_product_affinity.pitch END,
            calculado_em = CURRENT_TIMESTAMP
        `, [idp, idprod_rec, finalScore, 'CROSS_SELL_BOUGHT_TOGETHER', 'Comprado frequentemente por clientes com perfil similar ao seu.']);
        recCount++;
      }
    }

    await client.query('COMMIT');
    console.log(`[ML-CROSS] Ingestao de Cross-sell concluida: ${recCount} novas recomendacoes.`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[ML-CROSS] Erro no processamento de Cross-sell:', e.message);
  } finally {
    client.release();
  }
}

async function run() {
  await trainCrossSellRules();
  process.exit(0);
}

run();
