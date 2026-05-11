const { pool, ecoPool } = require('../src/main/db');
const omnichannelService = require('../src/main/services/omnichannelService');

async function dispatch() {
  console.log('--- RE-ENVIANDO PÍLULA DE CONHECIMENTO (CORREÇÃO DE LINKS) ---');
  
  try {
    const multiplicadores = await pool.query(`
      SELECT idpessoa, nmpessoa as nome 
      FROM wshop.pessoas 
      WHERE sttipopessoa = 'U' AND nrpager IS NOT NULL AND nrpager != ''
    `);

    const message = "Time de Multiplicadores! 🚨 Notamos um erro nos links da pílula de hoje de manhã. Por favor, utilizem este texto corrigido nos grupos das unidades:\n\n\"Bom dia, time! 🚀 Hoje é o grande dia da expansão! O EAV v1.1.5 já está disponível para os 50 representantes.\n\n📥 Baixe agora: https://github.com/vandencler/ecossistema-atomico-pc/releases/latest\n📖 Guia Rápido: https://wiki.atomico.com/guiarapido\n\nLembrem-se: o EAV é nosso braço direito para vender mais e melhor!\"";

    let successCount = 0;
    for (const m of multiplicadores.rows) {
      console.log(`Enviando correção para ${m.nome}...`);
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
      VALUES ('CMO_RECOVERY_PILL', 'Enviado correção de links para ' || $1 || ' multiplicadores.', 'sistema')
    `, [successCount]);

    console.log(`\n--- Correção Concluída: ${successCount}/${multiplicadores.rows.length} enviados ---`);
  } catch (e) {
    console.error('Falha no disparo:', e.message);
  } finally {
    process.exit(0);
  }
}

dispatch();
