
const cwd = process.cwd();
if (!cwd.toLowerCase().includes('-pc')) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error('This script MUST be executed from D:\projetos\ecossistema-atomico-pc');
    process.exit(1);
}

const { setSystemConfig } = require('../src/main/services/configService');

async function setupOnboardingConfigs() {
  console.log('--- Configurando Parâmetros de Onboarding (Fase 6) ---');
  
  const configs = [
    {
      chave: 'omni_welcome_message',
      valor: 'Olá! Você acaba de ser ativado no EAV v1.1.6! 🚀 Corrigimos o erro de conexão externa.\n\n📥 Baixe agora: https://github.com/vandencler/ecossistema-atomico-pc/releases/latest\n📖 Guia de Conexão: https://github.com/vandencler/ecossistema-atomico-pc/blob/master/docs/onboarding/AUTOCONFIGURACAO.md',
      descricao: 'Mensagem de boas-vindas para novos usuários (WhatsApp)'
    },
    {
      chave: 'omni_guide_url',
      valor: 'https://wiki.atomico.com/guiarapido',
      descricao: 'Link para o guia rápido/Wiki oficial'
    },
    {
      chave: 'omni_nps_message',
      valor: 'Olá! Você está usando o EAV há 48h. Em uma escala de 0 a 10, o quanto você recomendaria o sistema para um colega?',
      descricao: 'Mensagem de pesquisa NPS (WhatsApp)'
    }
  ];

  for (const c of configs) {
    try {
      await setSystemConfig(c.chave, c.valor);
      console.log(`✅ Configuração [${c.chave}] atualizada.`);
    } catch (e) {
      console.error(`❌ Erro ao configurar [${c.chave}]:`, e.message);
    }
  }

  console.log('--- Setup de Onboarding Concluído ---');
  process.exit(0);
}

setupOnboardingConfigs();
