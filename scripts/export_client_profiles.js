const fs = require('fs');
const path = require('path');
const { pool } = require('../src/main/db');

async function exportClientProfiles() {
  console.log('[ML-ETL] Extraindo perfis demográficos de clientes...');
  const outputDir = path.join(process.cwd(), 'ml_data');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const profileFile = path.join(outputDir, 'ml_client_profiles.csv');  

  try {
    const query = await pool.query(`
      SELECT
        p.idpessoa,
        p.sttipopessoa,
        p.iduf,
        p.nmcidade,
        p.dtcadastro,
        cr.sexo,
        cr.dtdatanasc,
        cr.vlsalario,
        cr.nrdependentes,
        cr.dsestcivil,
        cr.stcredautorizado,
        cr.stcredbloqueado,
        cr.conceito
      FROM wshop.pessoas p
      LEFT JOIN wshop.crediar cr ON cr.idpessoa = p.idpessoa
      WHERE p.stativo = 'S'
    `);

    let csv = 'idpessoa,sttipopessoa,iduf,nmcidade,dtcadastro,sexo,dtdatanasc,vlsalario,nrdependentes,dsestcivil,stcredautorizado,stcredbloqueado,conceito\n';  
    query.rows.forEach(r => {
      csv += `${r.idpessoa},${r.sttipopessoa},${r.iduf},"${r.nmcidade}",${r.dtcadastro ? r.dtcadastro.toISOString() : ''},${r.sexo},${r.dtdatanasc ? r.dtdatanasc.toISOString() : ''},${r.vlsalario},${r.nrdependentes},${r.dsestcivil},${r.stcredautorizado},${r.stcredbloqueado},${r.conceito}\n`;
    });

    fs.writeFileSync(profileFile, csv);
    console.log(`[ML-ETL] Salvo perfis de ${query.rowCount} clientes em ${profileFile}`);

  } catch (err) {
    console.error('[ML-ETL] Erro fatal durante a extracao de perfis:', err.message);
  } finally {
    const { pool, ecoPool } = require('../src/main/db');
    if (pool.raw) await pool.raw.end();
    if (ecoPool.raw) await ecoPool.raw.end();
  }
}

exportClientProfiles();
