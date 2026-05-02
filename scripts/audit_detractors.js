
const cwd = process.cwd();
if (!cwd.toLowerCase().includes("-pc")) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error("This script MUST be executed from D:\projetos\ecossistema-atomico-pc");
    process.exit(1);
}

const { ecoPool } = require('../src/main/db');

async function audit() {
  try {
    const res = await ecoPool.query(`
      SELECT idpessoa, sentiment_label, sentiment_score, feedback_text, criado_em
      FROM ml_client_sentiment
      WHERE sentiment_label = 'NEGATIVE'
      ORDER BY criado_em DESC
    `);
    
    console.log('=== Detractor Audit (Negative Sentiment) ===');
    if (res.rowCount === 0) {
      console.log('No detractors found. 🟢');
    } else {
      res.rows.forEach(r => {
        console.log(`- [${r.criado_em.toISOString()}] ID: ${r.idpessoa} | Score: ${r.sentiment_score}`);
        console.log(`  Text: "${r.feedback_text}"`);
      });
    }

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

audit();
