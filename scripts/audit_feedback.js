
const cwd = process.cwd();
if (!cwd.toLowerCase().includes('-pc')) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error('This script MUST be executed from D:\projetos\ecossistema-atomico-pc');
    process.exit(1);
}

const { ecoPool } = require('../src/main/db');

async function audit() {
  try {
    const res = await ecoPool.query(`
      SELECT user_id, satisfaction, comment, criado_em
      FROM app_feedback
      ORDER BY criado_em DESC
    `);
    
    console.log('=== User Feedback Audit ===');
    if (res.rowCount === 0) {
      console.log('No feedback entries found.');
    } else {
      res.rows.forEach(r => {
        const icon = r.satisfaction === 3 ? '🟢' : (r.satisfaction === 1 ? '🔴' : '🟡');
        console.log(`${icon} [${r.criado_em.toISOString()}] User: ${r.user_id}`);
        console.log(`   Comment: "${r.comment}"`);
      });
    }

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

audit();
