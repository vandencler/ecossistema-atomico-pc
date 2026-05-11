const { pool, ecoPool } = require('../src/main/db');
const omnichannelService = require('../src/main/services/omnichannelService');

async function verify() {
  console.log('--- ENVIANDO VERIFICAÇÃO TAKE 5 PARA MULTIPLICADORES ---');
  
  const multiplicadores = await pool.query(`
    SELECT idpessoa, nmpessoa as nome 
    FROM wshop.pessoas 
    WHERE sttipopessoa = 'U' AND nrpager IS NOT NULL AND nrpager != ''
  `);

  const message = "Multiplicadores! 🚨 Acabamos de enviar um novo link de conexão (Take 5). Por favor, confirmem se vocês ou alguém do time conseguiu conectar agora. O novo Host é: https://final-rate-florence-geography.trycloudflare.com";

  let successCount = 0;
  for (const m of multiplicadores.rows) {
    console.log(`Pinging ${m.nome}...`);
    const res = await omnichannelService.sendWhatsAppMessage(m.idpessoa, message);
    if (res.ok) {
      console.log(`  ✅ OK`);
      successCount++;
    } else {
      console.log(`  ❌ Falha: ${res.error}`);
    }
  }

  process.exit(0);
}

verify();
