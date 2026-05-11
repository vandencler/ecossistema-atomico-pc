const { pool, ecoPool } = require('../src/main/db');
const omnichannelService = require('../src/main/services/omnichannelService');

const PILLS = {
  "1": `📢 *Pílula de Conhecimento EAV - Especial SAV (Segunda-feira)*\n\nOlá Multiplicador! 🚀 Compartilhe esta mensagem no seu grupo de vendas:\n\n---\n"Bom dia, time! 🚀 Sabiam que muitos clientes deixam de comprar só porque mudaram de número e a gente não sabe? \nO EAV te dá o poder de corrigir isso! Viu um número errado? Use o ícone de **Lápis ✏️** na aba Cadastro. \nLimpando o cadastro hoje, você garante a venda de amanhã! 💪"\n---\n\nContamos com você para limparmos a nossa base! ✏️✨`,
  "2": `📢 *Pílula de Conhecimento EAV - Especial SAV (Terça-feira)*\n\nOlá Multiplicador! 🚀 Compartilhe esta mensagem no seu grupo de vendas:\n\n---\n"Dúvida comum: 'Corrigi no EAV, mas ainda não mudou no sistema da loja. Por que?' 🧐\nSimples: Suas correções vão para uma fila de aprovação do Gerente. \nAssim que ele der o 'OK', o EAV avisa você com o badge **✅ Concluído**. \nÉ segurança para a empresa e agilidade para você!"\n---`,
  "3": `📢 *Pílula de Conhecimento EAV - Especial SAV (Quarta-feira)*\n\nOlá Multiplicador! 🏆 Desafio de hoje! Compartilhe:\n\n---\n"Desafio SAV: Todo mundo corrigindo pelo menos 1 telefone ou e-mail hoje! ✏️\nVá na aba 'Risco de Abandono' 📉, tente o contato e, se o número estiver errado, já atualize na hora. \nQuem tiver mais sugestões aprovadas na semana ganha o selo de 'Mestre do Cadastro'! 👑"\n---`,
  "4": `📢 *Pílula de Conhecimento EAV - Especial SAV (Quinta-feira)*\n\nOlá Multiplicador! ⚡ Lembrete importante:\n\n---\n"Acabou a internet? O SAV não para! ⚡\nMesmo offline, você pode registrar as correções de cadastro. O EAV guarda tudo no seu PC e sincroniza com o gerente assim que o sinal voltar. \nNão tem desculpa para dado errado! 🚫📞"\n---`,
  "5": `📢 *Pílula de Conhecimento EAV - Especial SAV (Sexta-feira)*\n\nOlá Multiplicador! 👑 É hora de fechar a semana do SAV. Lembre o time que quem enviou mais correções ganha o destaque de 'Mestre do Cadastro' no briefing de Segunda-feira!\n\nPasso a Passo Rápido para lembrar o time:\n1. Abra o cliente no EAV.\n2. Vá na aba **Cadastro**.\n3. Clique no **Lápis ✏️** ao lado do dado errado.\n4. Digite o correto e **Salve**.\n5. Pronto! Agora é só aguardar o ✅ do seu gerente.\n\nObrigado por engajar o time nesta semana! 🚀`
};

async function dispatchSavPill() {
  const day = process.argv[2] || "1";
  const message = PILLS[day];

  if (!message) {
    console.error(`Erro: Pílula para o dia ${day} não encontrada. Use um número de 1 a 5.`);
    process.exit(1);
  }

  console.log(`--- Iniciando Disparo da Pílula de Conhecimento SAV (Dia ${day}) para Multiplicadores ---`);
  
  // 1. Identificar Multiplicadores (Power Users - sttipopessoa = 'U')
  const multipliersRes = await pool.query(`
    SELECT idpessoa, nmpessoa as nome, nrpager 
    FROM wshop.pessoas 
    WHERE sttipopessoa = 'U' AND nrpager IS NOT NULL AND nrpager != ''
  `);
  
  const targets = multipliersRes.rows;
  console.log(`Encontrados ${targets.length} Multiplicadores.`);

  let successCount = 0;
  for (const multiplier of targets) {
    console.log(`Enviando para ${multiplier.nome} (${multiplier.idpessoa})...`);
    try {
      const res = await omnichannelService.sendWhatsAppMessage(multiplier.idpessoa, message);
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
  
  // Registrar a ação no banco de governança
  try {
      await ecoPool.query(`
        INSERT INTO log_eventos (tipo, idpessoa, detalhe)
        VALUES ('CMO_DISPATCH_SAV_PILL_${day}', 'system', 'Pílula de Conhecimento SAV (Dia ${day}) enviada para ${successCount} multiplicadores.')
      `);
  } catch (e) {
      console.error('Erro ao registrar log:', e.message);
  }

  process.exit(0);
}

dispatchSavPill();