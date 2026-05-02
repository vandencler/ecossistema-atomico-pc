const fs = require('fs');
const path = require('path');
const { ecoPool, pool } = require('../src/main/db');

async function analyzeLookalikeSegmentation() {
  const profileFile = path.join(process.cwd(), 'ml_data', 'ml_client_profiles.csv');
  if (!fs.existsSync(profileFile)) {
    console.error('Profile CSV missing.');
    return;
  }

  try {
    // 1. Fetch VIP IDs and their segments
    const vipRes = await ecoPool.query(`
      SELECT p.idpessoa, p.sexo, p.sttipopessoa
      FROM ml_client_profiles p
      JOIN ranking_cache r ON r.idpessoa = p.idpessoa
      WHERE r.abc = 'A'
    `);
    
    const vips = vipRes.rows;
    console.log(`Analyzing segments for ${vips.length} VIPs...`);

    // 2. Group VIPs by segment and find their top products
    // (We need to use pool for this, which is partially blocked, but maybe docitem is only blocked for 'eav_writer'?)
    // Wait, eav_writer IS the user I'm using.
    // Let's try to query docitem for VIPs only.
    
    const segments = {
      'Masculino': [],
      'Feminino': [],
      'Corporate': [] // sttipopessoa = 'C' or something
    };

    vips.forEach(v => {
      if (v.sexo === 'Masculino') segments['Masculino'].push(v.idpessoa);
      else if (v.sexo === 'Feminino') segments['Feminino'].push(v.idpessoa);
      else if (v.sttipopessoa === 'C') segments['Corporate'].push(v.idpessoa);
    });

    console.log('Segment Counts:', {
      Masculino: segments['Masculino'].length,
      Feminino: segments['Feminino'].length,
      Corporate: segments['Corporate'].length
    });

    // 3. For each segment, find top products from CSV
    const affinityFile = path.join(process.cwd(), 'ml_data', 'ml_affinity_training.csv');
    if (!fs.existsSync(affinityFile)) {
      console.error('Affinity CSV missing.');
      return;
    }

    const affinityData = fs.readFileSync(affinityFile, 'utf8').split('\n').filter(Boolean).slice(1);
    const productCountsBySegment = {};

    console.log(`\nProcessing ${affinityData.length} affinity records from CSV...`);

    affinityData.forEach(row => {
      const [idp, idprod, qty] = row.split(',');
      
      for (const segmentName in segments) {
        if (segments[segmentName].includes(idp)) {
          if (!productCountsBySegment[segmentName]) productCountsBySegment[segmentName] = {};
          productCountsBySegment[segmentName][idprod] = (productCountsBySegment[segmentName][idprod] || 0) + 1;
        }
      }
    });

    // To get product names, we can try querying 'produto' table (might be blocked too)
    // or just show IDs for now.
    
    for (const segmentName in segments) {
      const counts = productCountsBySegment[segmentName];
      if (!counts) continue;

      const topProducts = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([idprod, count]) => ({ idproduto: idprod, client_count: count }));

      console.log(`\nTop Products for VIP Segment: ${segmentName}`);
      console.table(topProducts);
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

analyzeLookalikeSegmentation();
