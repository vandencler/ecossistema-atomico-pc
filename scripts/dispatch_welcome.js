const { pool, ecoPool } = require('../src/main/db');
const omnichannelService = require('../src/main/services/omnichannelService');

async function dispatch() {
  console.log('--- Inciando Disparo do Welcome Pack (Fase 6 - Expansão Wave 2) ---');
  
  // 1. Target current Users (sttipopessoa = 'U')
  const currentUsersRes = await pool.query(`
    SELECT idpessoa, nmpessoa as nome, nrpager 
    FROM wshop.pessoas 
    WHERE sttipopessoa = 'U' AND nrpager IS NOT NULL AND nrpager != ''
  `);
  
  const targets = currentUsersRes.rows.map(r => ({
    idpessoa: r.idpessoa,
    nome: r.nome,
    nrpager: r.nrpager,
    group: 'Power User'
  }));

  console.log(`Encontrados ${targets.length} Power Users.`);

  // 2. Target additional Representatives (sttipopessoa = 'F') to reach 50 total
  const needed = 50 - targets.length;
  if (needed > 0) {
    const additionalRes = await pool.query(`
      SELECT idpessoa, nmpessoa as nome, nrpager 
      FROM wshop.pessoas 
      WHERE sttipopessoa = 'F' 
        AND stativo = 'S' 
        AND nrpager IS NOT NULL 
        AND nrpager != ''
        AND idpessoa NOT IN (SELECT idpessoa FROM wshop.pessoas WHERE sttipopessoa = 'U')
      LIMIT ${needed}
    `);
    
    console.log(`Encontrados ${additionalRes.rowCount} novos representantes para a Wave 2.`);
    
    for (const r of additionalRes.rows) {
      targets.push({
        idpessoa: r.idpessoa,
        nome: r.nome,
        nrpager: r.nrpager,
        group: 'Wave 2'
      });
    }
  }

  // Ensure omnichannel_whatsapp_enabled is true
  await ecoPool.query("INSERT INTO config_sistema (chave, valor) VALUES ('omnichannel_whatsapp_enabled', 'true') ON CONFLICT (chave) DO UPDATE SET valor = 'true'");

  let successCount = 0;
  for (const user of targets) {
    console.log(`[${user.group}] Enviando para ${user.nome} (${user.idpessoa})...`);
    try {
      // Note: In a real scenario, we would use the specific template for Wave 2
      // For this script, we use the service's default welcome message which should be updated in config
      const res = await omnichannelService.sendWelcomeMessage(user.idpessoa, user.nrpager);
      if (res.ok) {
        console.log(`  ✅ Enviado. ID: ${res.externalId}`);
        successCount++;
      } else {
        console.log(`  ❌ Falha: ${res.error}`);
      }
    } catch (e) {
        console.log(`  ❌ Erro: ${e.message}`);
    }
  }

  console.log(`\n--- Disparo Concluído: ${successCount}/${targets.length} enviados com sucesso ---`);
  process.exit(0);
}

dispatch();