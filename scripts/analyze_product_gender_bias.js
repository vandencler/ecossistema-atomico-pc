const fs = require('fs');
const path = require('path');
const { ecoPool } = require('../src/main/db');

async function analyzeProductGenderBias() {
  const profileFile = path.join(process.cwd(), 'ml_data', 'ml_client_profiles.csv');
  const affinityFile = path.join(process.cwd(), 'ml_data', 'ml_affinity_training.csv');

  if (!fs.existsSync(profileFile) || !fs.existsSync(affinityFile)) {
    console.error('Data files missing.');
    return;
  }

  try {
    const profiles = fs.readFileSync(profileFile, 'utf8').split('\n').filter(Boolean).slice(1);
    const genderMap = {};
    profiles.forEach(row => {
      const parts = row.split(',');
      genderMap[parts[0]] = parts[5]; // sexo
    });

    const affinityData = fs.readFileSync(affinityFile, 'utf8').split('\n').filter(Boolean).slice(1);
    const productGenderCounts = {}; // { idprod: { Masculino: N, Feminino: N } }

    affinityData.forEach(row => {
      const [idp, idprod] = row.split(',');
      const gender = genderMap[idp];
      if (gender === 'Masculino' || gender === 'Feminino') {
        if (!productGenderCounts[idprod]) productGenderCounts[idprod] = { Masculino: 0, Feminino: 0 };
        productGenderCounts[idprod][gender]++;
      }
    });

    const bias = {};
    for (const idprod in productGenderCounts) {
      const counts = productGenderCounts[idprod];
      const total = counts.Masculino + counts.Feminino;
      if (total >= 10) { // Significance threshold
        const femPct = counts.Feminino / total;
        if (femPct > 0.8) bias[idprod] = 'Feminino';
        else if (femPct < 0.2) bias[idprod] = 'Masculino';
      }
    }

    console.log('Detected Product Gender Bias:');
    console.table(Object.entries(bias).slice(0, 20));

    // Save bias for cross-sell script to use
    fs.writeFileSync(path.join(process.cwd(), 'ml_data', 'product_gender_bias.json'), JSON.stringify(bias, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

analyzeProductGenderBias();
