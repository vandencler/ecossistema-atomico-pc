const { pool, ecoPool } = require('../src/main/db');
const omnichannelService = require('../src/main/services/omnichannelService');

async function take6() {
  console.log('--- DISPARO TAKE 6: CONEXÃO REESTABELECIDA ---');
  
  const powerUsers = await pool.query(`
    SELECT idpessoa, nmpessoa as nome, nrpager 
    FROM wshop.pessoas 
    WHERE (sttipopessoa = 'U' OR (sttipopessoa = 'F' AND stativo = 'S')) AND nrpager IS NOT NULL AND nrpager != ''
    LIMIT 50
  `);
  
  const targets = powerUsers.rows;

  const newUrl = "https://dans-myspace-triple-secretariat.trycloudflare.com";
  const message = `🚨 *EAV: CONEXÃO ESTABILIZADA!* 🚨\n\nAgora o sistema está pronto para uso externo. Siga estes passos:\n\n1️⃣ Abra o EAV > Configurações (Engrenagem)\n2️⃣ No Host, digite: ${newUrl}\n3️⃣ Clique em Salvar e reinicie o app.\n\nSe os indicadores no topo ficarem VERDES 🟢, você está conectado! 🚀\n\nGuia: https://github.com/vandencler/ecossistema-atomico-pc/blob/main/docs/onboarding/AUTOCONFIGURACAO.md`;

  let successCount = 0;
  for (const user of targets) {
    console.log(`Enviando Take 6 para ${user.nome}...`);
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
    VALUES ('CMO_TAKE6_NUDGE', 'Enviado Take 6 com link ' || $1 || ' para ' || $2 || ' usuários.', 'sistema')
  `, [newUrl, successCount]);

  console.log(`\n--- Take 6 Concluído: ${successCount}/${targets.length} enviados ---`);
  process.exit(0);
}

take6();
