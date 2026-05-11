const { pool, ecoPool } = require('../src/main/db');
const omnichannelService = require('../src/main/services/omnichannelService');

async function take7() {
  console.log('--- DISPARO TAKE 7: REUPERANDO ACESSO (v1.1.6) ---');
  
  const powerUsers = await pool.query(`
    SELECT idpessoa, nmpessoa as nome, nrpager 
    FROM wshop.pessoas 
    WHERE (sttipopessoa = 'U' OR (sttipopessoa = 'F' AND stativo = 'S')) AND nrpager IS NOT NULL AND nrpager != ''
    LIMIT 50
  `);
  
  const targets = powerUsers.rows;

  const newUrl = "https://wifi-committed-beneath-discussions.trycloudflare.com";
  const message = `🚨 *EAV: ATUALIZAÇÃO OBRIGATÓRIA (v1.1.6)* 🚨\n\nIdentificamos que a versão 1.1.5 estava impedindo o acesso externo. Já corrigimos!\n\n✅ *O QUE FAZER:* \n1️⃣ Baixe a v1.1.6 agora: https://github.com/vandencler/ecossistema-atomico-pc/releases/latest\n2️⃣ Se necessário, no Host, digite: ${newUrl}\n3️⃣ Indicadores VERDES 🟢 = Pronto para vender!\n\nGuia atualizado: https://github.com/vandencler/ecossistema-atomico-pc/blob/main/docs/onboarding/AUTOCONFIGURACAO.md`;

  let successCount = 0;
  for (const user of targets) {
    console.log(`Enviando Take 7 para ${user.nome}...`);
    try {
      // In a real environment, we'd check if they are already on v1.1.6 before nudging, 
      // but since adoption is 0, we nudge everyone.
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
    VALUES ('CMO_TAKE7_NUDGE', 'Enviado Take 7 (v1.1.6) para ' || $1 || ' usuários.', 'sistema')
  `, [successCount]);

  console.log(`\n--- Take 7 Concluído: ${successCount}/${targets.length} enviados ---`);
  process.exit(0);
}

take7();
