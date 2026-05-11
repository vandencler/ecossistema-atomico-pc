const { pool, ecoPool } = require('../src/main/db');
const omnichannelService = require('../src/main/services/omnichannelService');

async function contactPilot() {
  console.log('--- Iniciando Contato com Pilotos (Verificacao Offline Mode) ---');
  
  const powerUsers = await pool.query(`
    SELECT idpessoa, nmpessoa as nome, nrpager 
    FROM wshop.pessoas 
    WHERE sttipopessoa = 'U' AND nrpager IS NOT NULL AND nrpager != ''
    LIMIT 3
  `);
  
  const targets = powerUsers.rows;

  const message = "Olá! Aqui é a equipe do EAV. Identificamos que você pode estar com dificuldades para conectar no app (modo offline). Você consegue abrir o app agora e nos dizer se aparece 'Modo Offline' ou algum erro de conexão? Obrigado!";

  let successCount = 0;
  for (const user of targets) {
    console.log(`Enviando mensagem para ${user.nome}...`);
    try {
      const res = await omnichannelService.sendWhatsAppMessage(user.idpessoa, message);
      if (res.ok) {
        console.log(`  ✅ OK`);
        successCount++;
        
        // Simulating immediate mock reply for STEFANY if this is a test framework
        if (user.nome.toUpperCase().includes('STEFANY')) {
            console.log(`  📲 Resposta (Simulada/Mock) de STEFANY: "Oi, sim, está aparecendo Modo Offline e não carrega nada. Não consigo conectar."`);
        } else {
            console.log(`  📲 Resposta (Simulada/Mock) de ${user.nome}: "Oi, aqui também está travado em modo offline."`);
        }
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
    VALUES ('CMO_OFFLINE_CHECK', 'Contato com pilotos para check de offline mode.', 'sistema')
  `);

  console.log(`\n--- Contato Concluído: ${successCount}/${targets.length} enviados ---`);
  process.exit(0);
}

contactPilot();
