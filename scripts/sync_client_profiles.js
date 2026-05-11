
const cwd = process.cwd();
if (!cwd.toLowerCase().includes('-pc')) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error('This script MUST be executed from D:\projetos\ecossistema-atomico-pc');
    process.exit(1);
}

const fs = require('fs');
const path = require('path');
const { ecoPool } = require('../src/main/db');

const profileFile = path.join(process.cwd(), 'ml_data', 'ml_client_profiles.csv');

async function syncClientProfiles() {
  if (!fs.existsSync(profileFile)) {
    console.log('[ML-SYNC] Arquivo de perfis nao encontrado. Execute a extracao (export_client_profiles) primeiro.');
    return;
  }

  console.log('[ML-SYNC] Sincronizando perfis demograficos de clientes...');
  const lines = fs.readFileSync(profileFile, 'utf8').split('\n').filter(Boolean);
  const header = lines[0].split(',');
  const data = lines.slice(1);
  
  const client = await ecoPool.raw.connect();
  try {
    await client.query('BEGIN');

    for (const line of data) {
      // Split by comma but handle quotes and empty fields correctly
      const parts = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
          parts.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      parts.push(current);

      if (parts.length < 12) continue;

      const clean = p => {
        let s = (p || '').trim().replace(/^"|"$/g, '').trim();
        return (s === 'null' || s === '') ? null : s;
      };
      
      const idp = clean(parts[0]);
      const tipo = clean(parts[1]);
      const uf = clean(parts[2]);
      const cidade = clean(parts[3]);
      const cad = clean(parts[4]);
      const sexo = clean(parts[5]);
      const nasc = clean(parts[6]);
      const blocked = clean(parts[11]) === 'true';

      const birthDate = nasc;
      const registrationDate = cad;

      await client.query(`
        INSERT INTO ml_client_profiles (idpessoa, sexo, data_nascimento, cidade, uf, stcredbloqueado, sttipopessoa, dtcadastro, calculado_em)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
        ON CONFLICT (idpessoa) DO UPDATE SET
          sexo = EXCLUDED.sexo,
          data_nascimento = EXCLUDED.data_nascimento,
          cidade = EXCLUDED.cidade,
          uf = EXCLUDED.uf,
          stcredbloqueado = EXCLUDED.stcredbloqueado,
          sttipopessoa = EXCLUDED.sttipopessoa,
          dtcadastro = EXCLUDED.dtcadastro,
          calculado_em = CURRENT_TIMESTAMP
      `, [idp, sexo, birthDate, cidade, uf, blocked, tipo, registrationDate]);
    }

    await client.query('COMMIT');
    console.log(`[ML-SYNC] Sincronizacao concluida: ${data.length} perfis processados.`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[ML-SYNC] Erro na sincronizacao:', e.message);
  } finally {
    client.release();
  }
}

syncClientProfiles().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
