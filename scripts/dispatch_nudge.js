const { pool, ecoPool } = require('../src/main/db');
const omnichannelService = require('../src/main/services/omnichannelService');

async function nudge() {
  console.log('--- Iniciando Reforço de Lançamento (Nudge Wave 2) ---');
  
  // Get the same 50 targets as dispatch_welcome.js
  const powerUsers = await pool.query(`
    SELECT idpessoa, nmpessoa as nome, nrpager 
    FROM wshop.pessoas 
    WHERE sttipopessoa = 'U' AND nrpager IS NOT NULL AND nrpager != ''
  `);
  
  const targets = powerUsers.rows.map(r => ({ idpessoa: r.idpessoa, nome: r.nome, nrpager: r.nrpager }));

  const needed = 50 - targets.length;
  if (needed > 0) {
    const additional = await pool.query(`
      SELECT idpessoa, nmpessoa as nome, nrpager 
      FROM wshop.pessoas 
      WHERE sttipopessoa = 'F' AND stativo = 'S' AND nrpager IS NOT NULL AND nrpager != ''
      AND idpessoa NOT IN (SELECT idpessoa FROM wshop.pessoas WHERE sttipopessoa = 'U')
      LIMIT ${needed}
    `);
    targets.push(...additional.rows);
  }

  const message = "Opa! Pedimos desculpas, mas os links anteriores estavam com um erro. 🛠️ Aqui está o acesso OFICIAL e CORRIGIDO do EAV v1.1.6:\n\n📥 Baixe aqui: https://github.com/vandencler/ecossistema-atomico-pc/releases/latest\n📖 Guia Rápido: https://wiki.atomico.com/guiarapido\n\nAgora sim, vamos decolar! 🚀";

  let successCount = 0;
  for (const user of targets) {
    console.log(`Enviando reforço para ${user.nome}...`);
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
    VALUES ('CMO_LAUNCH_NUDGE', 'Enviado reforço de link para ' || $1 || ' usuários.', 'sistema')
  `, [successCount]);

  console.log(`\n--- Reforço Concluído: ${successCount}/${targets.length} enviados ---`);
  process.exit(0);
}

nudge();
