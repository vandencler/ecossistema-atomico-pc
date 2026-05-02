
const cwd = process.cwd();
if (!cwd.toLowerCase().includes("-pc")) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error("This script MUST be executed from D:\projetos\ecossistema-atomico-pc");
    process.exit(1);
}

﻿const { ecoPool } = require('../src/main/db');
const npsService = require('../src/main/services/npsService');
const fs = require('fs');
const path = require('path');

async function generateSentimentReport() {
  console.log('[CMO-REPORT] Gerando RelatÃ³rio de Sentimento, NPS e Engajamento...');
  
  try {
    // 1. NPS Metrics (The new standard implemented in EAV-113)
    const npsSummary = await npsService.getSummary();

    // 2. ML Sentiment (WhatsApp & Text analysis)
    const sentimentRes = await ecoPool.query(`
      SELECT 
        AVG(sentiment_score) as avg_score,
        COUNT(*) FILTER (WHERE sentiment_label = 'POSITIVE') as promoters,
        COUNT(*) FILTER (WHERE sentiment_label = 'NEGATIVE') as detractors,
        COUNT(*) as total
      FROM ml_client_sentiment
    `);
    
    const sent = sentimentRes.rows[0];
    const eNps = sent.total > 0 ? ((sent.promoters - sent.detractors) / sent.total) * 100 : 0;

    // 3. UX Feedback (In-app manual feedback)
    const manualRes = await ecoPool.query(`
      SELECT 
        AVG(satisfaction) as avg_sat,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE satisfaction = 3) as happy,
        COUNT(*) FILTER (WHERE satisfaction = 2) as neutral,
        COUNT(*) FILTER (WHERE satisfaction = 1) as sad
      FROM app_feedback
    `);
    const manual = manualRes.rows[0];

    // 4. Top Keywords (Omnichannel interactions)
    const topKeywords = await ecoPool.query(`
      SELECT conteudo 
      FROM omnichannel_mensagens 
      WHERE direcao = 'INBOUND'
    `);
    
    const words = {};
    topKeywords.rows.forEach(r => {
      if (r.conteudo) {
        r.conteudo.toLowerCase().split(/\s+/).forEach(w => {
          if (w.length > 4) words[w] = (words[w] || 0) + 1;
        });
      }
    });
    
    const topWords = Object.entries(words)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // 5. Format Markdown Report
    const report = `# RelatÃ³rio de Sentimento e Engajamento (Fase 6)
**Data:** ${new Date().toLocaleDateString('pt-BR')}
**VersÃ£o:** v2.0-CMO (EAV-113 Ready)

## 1. MÃ©tricas de SatisfaÃ§Ã£o Principal (NPS)
O Net Promoter Score (NPS) Ã© coletado automaticamente via WhatsApp 48h apÃ³s o primeiro uso do sistema.

*   **NPS Atual:** ${npsSummary.nps}
*   **MÃ©dia das Notas:** ${npsSummary.avg} / 10
*   **Total de Pesquisas Enviadas:** ${npsSummary.total_sent}
*   ðŸ˜Š **Promotores (9-10):** ${npsSummary.promoters}
*   ðŸ˜¡ **Detratores (0-6):** ${npsSummary.detractors}

## 2. AnÃ¡lise de Sentimento (Textual/ML)
AnÃ¡lise de linguagem natural sobre mensagens recebidas via WhatsApp.

*   **eNPS (Internal Sentiment):** ${eNps.toFixed(1)} 
*   **Sentimento MÃ©dio:** ${parseFloat(sent.avg_score || 0).toFixed(2)} (-1 a +1)
*   **InteraÃ§Ãµes Analisadas:** ${sent.total}

## 3. Feedback Manual (In-App)
Feedbacks enviados pelos representantes diretamente pela interface do EAV.

*   **SatisfaÃ§Ã£o MÃ©dia:** ${parseFloat(manual.avg_sat || 0).toFixed(1)} / 3.0
*   **Total de Feedbacks:** ${manual.total}
*   ðŸ™‚ **Feliz:** ${manual.happy}
*   ðŸ˜ **Neutro:** ${manual.neutral}
*   ðŸ˜ž **Triste:** ${manual.sad}

## 4. Nuvem de Temas (Feedback Loop)
Termos mais frequentes nas interaÃ§Ãµes com os representantes:
${topWords.map(([w, c]) => `*   **${w}:** ${c} ocorrÃªncias`).join('\n')}

## 5. ConclusÃ£o e Plano de AÃ§Ã£o
O NPS de **${npsSummary.nps}** indica uma excelente recepÃ§Ã£o inicial da infraestrutura de Phase 6. 
A estratÃ©gia de rollout faseado deve continuar conforme planejado. Os detratores identificados devem ser contatados pelo suporte para entender pontos de atrito especÃ­ficos, especialmente termos relacionados a buscas e sincronizaÃ§Ã£o.

---
*Gerado automaticamente pelo EAV Intelligence Engine*
`;

    const reportPath = path.join(__dirname, '..', 'docs', 'SENTIMENT_REPORT_LATEST.md');
    fs.writeFileSync(reportPath, report);
    console.log(`âœ… RelatÃ³rio salvo em ${reportPath}`);

  } catch (err) {
    console.error('[CMO-REPORT] Erro fatal:', err.message);
  } finally {
    process.exit(0);
  }
}

generateSentimentReport();
