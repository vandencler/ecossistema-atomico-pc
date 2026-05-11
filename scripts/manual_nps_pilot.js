const { pool, ecoPool } = require('../src/main/db');
const omnichannelService = require('../src/main/services/omnichannelService');

async function runManualNps() {
  console.log('=== DISPARO MANUAL DE NPS - PILOTO FASE 6 (CMO) ===\n');

  // 1. Get the 10 Power Users
  const usersRes = await pool.query(`
    SELECT idpessoa, nmpessoa as nome, nrpager 
    FROM wshop.pessoas 
    WHERE sttipopessoa = 'U' AND stativo = 'S' AND nrpager IS NOT NULL AND nrpager != ''
  `);

  const targets = usersRes.rows;
  console.log(`Encontrados ${targets.length} usuários para o disparo manual.`);

  const message = "Olá! Você completou sua primeira semana com o EAV. 🚀 Como está sua experiência? De 0 a 10, o quanto o sistema tem ajudado no seu dia a dia? (Responda apenas com o número)";

  for (const user of targets) {
    console.log(`Enviando para ${user.nome} (${user.idpessoa})...`);
    try {
      const res = await omnichannelService.sendWhatsAppMessage(user.idpessoa, message);
      if (res.ok) {
        console.log(`  ✅ Enviado. ID: ${res.externalId}`);
        // Record in nps_scores to track responses later
        await ecoPool.query(`
          INSERT INTO nps_scores (user_id, idpessoa, status)
          VALUES ($1, $2, 'SENT')
        `, [user.idpessoa, user.idpessoa]); // Using idpessoa as user_id to avoid mapping issues
      } else {
        console.log(`  ❌ Falha: ${res.error}`);
      }
    } catch (e) {
      console.log(`  ❌ Erro: ${e.message}`);
    }
  }

  console.log('\n--- Disparo Finalizado ---');
  process.exit(0);
}

runManualNps();
