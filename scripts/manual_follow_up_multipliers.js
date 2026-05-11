const { pool, ecoPool } = require('../src/main/db');
const omnichannelService = require('../src/main/services/omnichannelService');

async function checkIn() {
  console.log('--- Iniciando Follow-up Manual com Multiplicadores (Wave 2) ---');
  
  const powerUsers = await pool.query(`
    SELECT idpessoa, nmpessoa as nome, nrpager 
    FROM wshop.pessoas 
    WHERE sttipopessoa = 'U' AND nrpager IS NOT NULL AND nrpager != ''
  `);
  
  const targets = powerUsers.rows.map(r => ({ idpessoa: r.idpessoa, nome: r.nome, nrpager: r.nrpager }));

  const message = "Olá Multiplicador! 🚨 Passando para verificar: o seu time conseguiu baixar e instalar a versão v1.1.6 e conectar usando o novo link (sem cloudflared)? Se alguém ainda estiver com problemas ou relatando que o sistema não abre, me avise por aqui!";

  let successCount = 0;
  for (const user of targets) {
    console.log(`Enviando follow-up para ${user.nome}...`);
    try {
      const res = await omnichannelService.sendWhatsAppMessage(user.idpessoa, message);
      if (res.ok) {
        console.log(`  ✅ OK`);
        successCount++;
      } else {
        console.log(`  ❌ Falha: ${res.error}`);
      }
    } catch (e) {
      console.log(`  ❌ Erro: ${e.message}`);
    }
  }

  // Log this action
  await ecoPool.query(`
    INSERT INTO log_eventos (tipo, detalhe, usuario)
    VALUES ('CMO_MANUAL_FOLLOWUP', 'Enviado follow-up de adoção para ' || $1 || ' multiplicadores.', 'sistema')
  `, [successCount]);

  console.log(`\n--- Follow-up Concluído: ${successCount}/${targets.length} enviados ---`);
  process.exit(0);
}

checkIn();
