const { pool, ecoPool } = require('../src/main/db');
const omnichannelService = require('../src/main/services/omnichannelService');

async function dispatch() {
  console.log('--- ENVIANDO GUIA DE AUTOCONFIGURAÇÃO PARA MULTIPLICADORES ---');
  
  try {
    const multiplicadores = await pool.query(`
      SELECT idpessoa, nmpessoa as nome 
      FROM wshop.pessoas 
      WHERE sttipopessoa = 'U' AND nrpager IS NOT NULL AND nrpager != ''
    `);

    const message = "Multiplicadores! 🛠️ Para agilizar a instalação do time de vocês, criamos o **Manual de Autoconfiguração**. \n\nCompartilhem o link abaixo com quem estiver com dificuldade de conectar:\n\n📖 Manual Rápido: https://github.com/vandencler/ecossistema-atomico-pc/blob/main/docs/onboarding/AUTOCONFIGURACAO.md\n\nIsso evita que todos precisem chamar o TI! 🚀";

    let successCount = 0;
    for (const m of multiplicadores.rows) {
      console.log(`Enviando Guia para ${m.nome}...`);
      const res = await omnichannelService.sendWhatsAppMessage(m.idpessoa, message);
      if (res.ok) {
        console.log(`  ✅ OK`);
        successCount++;
      } else {
        console.log(`  ❌ Falha: ${res.error}`);
      }
    }

    await ecoPool.query(`
      INSERT INTO log_eventos (tipo, detalhe, usuario)
      VALUES ('CMO_CONFIG_GUIDE_DISPATCH', 'Enviado Guia de Autoconfiguração para ' || $1 || ' multiplicadores.', 'sistema')
    `, [successCount]);

    console.log(`\n--- Envio Concluído: ${successCount}/${multiplicadores.rows.length} enviados ---`);
  } catch (e) {
    console.error('Falha no disparo:', e.message);
  } finally {
    process.exit(0);
  }
}

dispatch();
