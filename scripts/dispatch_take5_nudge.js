const { pool, ecoPool } = require('../src/main/db');
const omnichannelService = require('../src/main/services/omnichannelService');

async function take5() {
  console.log('--- DISPARO TAKE 5: NOVO LINK DE CONEXÃO ATIVO ---');
  
  // Get 50 targets (Wave 2)
  const powerUsers = await pool.query(`
    SELECT idpessoa, nmpessoa as nome, nrpager 
    FROM wshop.pessoas 
    WHERE (sttipopessoa = 'U' OR (sttipopessoa = 'F' AND stativo = 'S')) AND nrpager IS NOT NULL AND nrpager != ''
    LIMIT 50
  `);
  
  const targets = powerUsers.rows;

  const newUrl = "https://final-rate-florence-geography.trycloudflare.com";
  const message = `🚨 *URGENTE: CONEXÃO ATUALIZADA!* 🚨\n\nTivemos que reiniciar o servidor de conexão externa. Use este novo link agora:\n\n🔗 *Novo Host:* ${newUrl}\n\n1️⃣ Abra o EAV > Configurações (Engrenagem)\n2️⃣ Troque o Host nos dois campos por esse link acima\n3️⃣ Salve e seja feliz! 🚀\n\nGuia atualizado: https://github.com/vandencler/ecossistema-atomico-pc/blob/main/docs/onboarding/AUTOCONFIGURACAO.md`;

  let successCount = 0;
  for (const user of targets) {
    console.log(`Enviando Take 5 para ${user.nome}...`);
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

  await ecoPool.query(`
    INSERT INTO log_eventos (tipo, detalhe, usuario)
    VALUES ('CMO_TAKE5_NUDGE', 'Enviado Take 5 com link ' || $1 || ' para ' || $2 || ' usuários.', 'sistema')
  `, [newUrl, successCount]);

  console.log(`\n--- Take 5 Concluído: ${successCount}/${targets.length} enviados ---`);
  process.exit(0);
}

take5();
