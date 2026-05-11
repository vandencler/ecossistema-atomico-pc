const { pool, ecoPool } = require('../src/main/db');
const omnichannelService = require('../src/main/services/omnichannelService');

async function finalNudge() {
  console.log('--- DISPARO FINAL: CORREÇÃO DE CONEXÃO WAVE 2 ---');
  
  // Get 50 targets (Wave 2)
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

  const message = "🚨 *URGENTE: ACESSO CORRIGIDO!* 🚨\n\nConseguimos simplificar a conexão para vocês! Agora NÃO precisa de nenhum comando técnico.\n\n1️⃣ Baixe a versão v1.1.6: https://github.com/vandencler/ecossistema-atomico-pc/releases/latest\n2️⃣ No Host, use exatamente: https://ping-drum-fiction-scholarship.trycloudflare.com\n\nPronto! O sistema vai conectar automaticamente de qualquer lugar. 🚀\n\n📖 Guia de Auto-Configuração: https://wiki.atomico.com/autoconfig";

  let successCount = 0;
  for (const user of targets) {
    console.log(`Enviando correção final para ${user.nome}...`);
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
    VALUES ('CMO_FINAL_CONNECTION_FIX', 'Enviado correção final de conexão para ' || $1 || ' usuários.', 'sistema')
  `, [successCount]);

  console.log(`\n--- Disparo Concluído: ${successCount}/${targets.length} enviados ---`);
  process.exit(0);
}

finalNudge();
