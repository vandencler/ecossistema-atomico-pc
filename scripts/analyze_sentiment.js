
const cwd = process.cwd();
if (!cwd.toLowerCase().includes('-pc')) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error('This script MUST be executed from D:\projetos\ecossistema-atomico-pc');
    process.exit(1);
}

const { ecoPool } = require('../src/main/db');
const sentimentService = require('../src/main/services/sentimentService');

async function analyzeSentiment() {
  console.log('[ML-SENTIMENT] Iniciando analise de sentimento das mensagens...');
  
  try {
    // We can just call the batchAnalyze method from the service
    await sentimentService.batchAnalyze();
    console.log('[ML-SENTIMENT] Processamento concluído via SentimentService.');
  } catch (err) {
    console.error('[ML-SENTIMENT] Erro fatal:', err.message);
  }
}

async function run() {
  await analyzeSentiment();
  process.exit(0);
}

run();
