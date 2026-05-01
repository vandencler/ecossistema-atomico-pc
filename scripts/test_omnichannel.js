const omnichannel = require('../src/main/services/omnichannelService');
const { pool } = require('../src/main/db');

/**
 * Utility to test the WhatsApp Integration (Vector C)
 * Usage: node scripts/test_omnichannel.js <idpessoa> <message_type>
 */

async function main() {
  const args = process.argv.slice(2);
  const idpessoa = args[0] || '0100DTXY0A'; // Sample ID
  const type = args[1] || 'approval';

  console.log('=== Omnichannel Test Utility ===');
  console.log(`ID Cliente: ${idpessoa}`);
  console.log(`Tipo:       ${type}`);
  console.log('-------------------------------');

  try {
    let result;
    if (type === 'approval') {
      result = await omnichannel.notifySavApproval(idpessoa, 'E-mail');
    } else {
      result = await omnichannel.sendWhatsAppMessage(idpessoa, 'Teste manual de integração EAV.');
    }

    if (result.ok) {
      console.log(`✅ SUCESSO: Mensagem despachada para ${result.phone}`);
    } else {
      console.error(`❌ FALHA: ${result.error}`);
    }
  } catch (e) {
    console.error(`❌ ERRO FATAL: ${e.message}`);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();