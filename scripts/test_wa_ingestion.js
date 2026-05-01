const omnichannel = require('../src/main/services/omnichannelService');
const intel = require('../src/main/services/intelligenceService');

async function test() {
  const idpessoa = '0100DTXY0A'; // A client ID from the logs
  const content = 'Gostaria de saber mais sobre o produto X';
  const externalId = 'wa_test_' + Date.now();

  console.log('--- Testando Ingestão de WhatsApp ---');
  const res = await omnichannel.ingestInboundMessage(idpessoa, content, externalId);
  console.log('Resultado da ingestão:', res);

  console.log('--- Verificando Impacto no Score ---');
  const data = {
    idpessoa,
    abc: 'A',
    dias_sem_compra: 10,
    origem: 'SISTEMA',
    tipo_acao: 'TEST_WA',
    criado_em: new Date()
  };

  const score = await intel.calculatePriority(data);
  console.log('Score (com engajamento recente):', score);
}

test().catch(console.error);
