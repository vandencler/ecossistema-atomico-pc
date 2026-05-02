
const cwd = process.cwd();
if (!cwd.toLowerCase().includes('-pc')) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error('This script MUST be executed from D:\projetos\ecossistema-atomico-pc');
    process.exit(1);
}


const { ecoPool } = require('../src/main/db');
const omnichannel = require('../src/main/services/omnichannelService');

async function send() {
  console.log('--- Enviando Pílula de Conhecimento: Oportunidade Sorocaba ---');
  
  // Power Users identified from NPS/Activity
  const powerUsers = ['test_rep_abs', 'rep_001', '0100AZORAV']; 

  const message = '✨ *Dica de Ouro: Oportunidade Sorocaba* ✨\n\nIdentificamos mais de 8.000 clientes em Sorocaba que são "Lookalikes" (têm perfil de grandes compradores, mas ainda compram pouco). \n\nProcure pelo badge *Sucesso na Região* ✨ nas sugestões e ajude esses clientes a crescerem! 🚀';

  for (const id of powerUsers) {
    try {
      // In a real scenario, we'd look up the rep's phone number.
      // For the pilot, we record the interaction.
      await omnichannel.sendWhatsAppMessage(id, message);
      console.log(`✅ Pílula enviada para ${id}`);
    } catch (e) {
      console.error(`❌ Falha ao enviar para ${id}:`, e.message);
    }
  }

  process.exit();
}

send();
