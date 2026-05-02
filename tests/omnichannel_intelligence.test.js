const intelligence = require('../src/main/services/intelligenceService');
const omnichannel = require('../src/main/services/omnichannelService');
const { ecoPool } = require('../src/main/db');

async function testWhatsAppScoring() {
  const idpessoa = 'TEST_CLIENT_001';
  
  console.log('--- Testing WhatsApp Engagement Scoring ---');

  // 1. Initial Score
  const baseData = {
    idpessoa,
    abc: 'C',
    aniversario_hoje: false,
    dias_sem_compra: 100,
    origem: 'SISTEMA',
    tipo_acao: 'DEFAULT',
    criado_em: new Date()
  };

  const initialScore = await intelligence.calculatePriority(baseData);
  console.log(`Initial Score (No WhatsApp): ${initialScore}`);

  // 2. Simulate Outbound Message
  console.log('Simulating Outbound Message...');
  // We need to enable WhatsApp in config first for the service to work, 
  // but since we are testing internal methods or using pool directly, 
  // let's use the service's internal recorder if possible or just pool.
  
  await ecoPool.query("INSERT INTO config_sistema (chave, valor) VALUES ('omnichannel_whatsapp_enabled', 'true') ON CONFLICT (chave) DO UPDATE SET valor = 'true'");
  
  await omnichannel._recordInteraction(idpessoa, 'OUTBOUND', 'Teste outbound', 'SENT');
  
  const outboundScore = await intelligence.calculatePriority(baseData);
  console.log(`Score after Outbound: ${outboundScore} (Expected: ~${initialScore + 5})`);

  // 3. Simulate Inbound Message
  console.log('Simulating Inbound Message...');
  await omnichannel.ingestInboundMessage(idpessoa, 'Obrigado!', 'external_123');
  
  const inboundScore = await intelligence.calculatePriority(baseData);
  console.log(`Score after Inbound: ${inboundScore} (Expected: ~${initialScore + 15})`);

  // Cleanup
  await ecoPool.query('DELETE FROM omnichannel_mensagens WHERE idpessoa = $1', [idpessoa]);
  await ecoPool.query('DELETE FROM clientes_enriquecidos WHERE idpessoa = $1', [idpessoa]);
  
  if (inboundScore > outboundScore && outboundScore > initialScore) {
    console.log('✅ WhatsApp Scoring Integration Verified!');
  } else {
    console.error('❌ Scoring Integration Failed logic check.');
  }
}

testWhatsAppScoring().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
