
const cwd = process.cwd();
if (!cwd.toLowerCase().includes('-pc')) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error('This script MUST be executed from D:\\projetos\\ecossistema-atomico-pc');
    process.exit(1);
}

const { ecoPool } = require('../src/main/db');

async function audit() {
  try {
    const res = await ecoPool.query(`
      SELECT idpessoa, sentiment_label, sentiment_score, last_message_at, calculado_em
      FROM ml_client_sentiment
      WHERE sentiment_label = 'NEGATIVE'
      ORDER BY calculado_em DESC
    `);

    console.log('=== Detractor Audit (Negative Sentiment - ML) ===');
    if (res.rowCount === 0) {
      console.log('No ML detractors found. 🟢');
    } else {
      res.rows.forEach(r => {
        console.log(`- [${r.calculado_em.toISOString()}] ID: ${r.idpessoa} | Score: ${r.sentiment_score}`);
        console.log(`  Last Interaction: ${r.last_message_at}`);
      });
    }

    const appFeed = await ecoPool.query(`
      SELECT user_id, satisfaction, comment, criado_em
      FROM app_feedback
      WHERE satisfaction = 1
      ORDER BY criado_em DESC
    `);

    console.log('\n=== Detractor Audit (Satisfaction = 1 - App Feedback) ===');
    if (appFeed.rowCount === 0) {
      console.log('No negative app feedback found. 🟢');
    } else {
      appFeed.rows.forEach(r => {
        console.log(`- [${r.criado_em.toISOString()}] User: ${r.user_id}`);
        console.log(`  Comment: "${r.comment}"`);
      });
    }

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

audit();
