const { ecoPool } = require('../src/main/db');
const fs = require('fs');
const path = require('path');

async function exportProfiles() {
  console.log('[ML-ETL] Exportando perfis de clientes para CSV...');
  try {
    const res = await ecoPool.query('SELECT * FROM ml_client_profiles');
    const outputDir = path.join(process.cwd(), 'ml_data');
    const filePath = path.join(outputDir, 'ml_client_profiles.csv');

    if (res.rowCount === 0) {
      console.log('[ML-ETL] Nenhum perfil encontrado.');
      return;
    }

    const keys = Object.keys(res.rows[0]);
    let csv = keys.join(',') + '\n';
    
    res.rows.forEach(r => {
      csv += keys.map(k => {
        const val = r[k];
        if (val === null || val === undefined) return '';
        if (val instanceof Date) return val.toISOString();
        if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
        return val;
      }).join(',') + '\n';
    });

    fs.writeFileSync(filePath, csv);
    console.log(`[ML-ETL] Salvo ${res.rowCount} perfis em ${filePath}`);
  } catch (err) {
    console.error('[ML-ETL] Erro ao exportar perfis:', err.message);
  } finally {
    process.exit(0);
  }
}

exportProfiles();
