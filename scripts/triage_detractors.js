
const cwd = process.cwd();
if (!cwd.toLowerCase().includes("-pc")) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error("This script MUST be executed from D:\\projetos\\ecossistema-atomico-pc");
    process.exit(1);
}

const { ecoPool } = require('../src/main/db');

async function triageDetractors() {
  console.log('=== PILOT SENTIMENT TRIAGE (CMO SUPPORT) ===\n');

  try {
    console.log('--- Checking WhatsApp Sentiment (ML) ---');
    const res = await ecoPool.query(`
      SELECT
        idpessoa,
        sentimento,
        sentiment_score,
        conteudo as message,
        data_mensagem
      FROM v_sentimento_feedback
      WHERE sentimento = 'NEGATIVE'
      ORDER BY data_mensagem DESC
      LIMIT 10
    `);

    if (res.rowCount === 0) {
      console.log('🟢 No recent negative WhatsApp sentiment identified.');
    } else {
      console.log(`🔴 Identified ${res.rowCount} negative WhatsApp interactions:\n`);  
      console.table(res.rows.map(r => ({
        User: r.idpessoa,
        Score: r.sentiment_score,
        Message: r.message.substring(0, 50) + (r.message.length > 50 ? '...' : ''),
        Date: r.data_mensagem
      })));
    }

    console.log('\n--- Checking App Feedback (Satisfaction = 1) ---');
    const appFeed = await ecoPool.query(`
      SELECT user_id, satisfaction, comment, criado_em
      FROM app_feedback
      WHERE satisfaction = 1
      ORDER BY criado_em DESC
      LIMIT 10
    `);

    if (appFeed.rowCount === 0) {
      console.log('🟢 No recent negative app feedback found.');
    } else {
      console.log(`🔴 Identified ${appFeed.rowCount} negative app feedback entries:\n`);
      console.table(appFeed.rows.map(r => ({
        User: r.user_id,
        Satisfaction: r.satisfaction,
        Comment: r.comment.substring(0, 50) + (r.comment.length > 50 ? '...' : ''),
        Date: r.criado_em
      })));
    }

    console.log('\n--- RECOMMENDED ACTION ---');
    console.log('1. Verify if the user is a Power User (Monday 10-rep group).');
    console.log('2. Check Telemetry for IPC_TOGGLESIDEBAR frequency (likely Sidebar Bug).');
    console.log('3. Trigger manual reach-out if score < -0.5 or satisfaction = 1.');

  } catch (err) {
    console.error('Error in triage:', err.message);
  } finally {
    process.exit(0);
  }
}

triageDetractors();
