const { ecoPool } = require('../src/main/db');

async function checkNegativeFeedback() {
  console.log('--- Analisando Feedbacks Negativos (App) ---');
  try {
    const res = await ecoPool.query(`
      SELECT satisfaction, comment, criado_em, user_id
      FROM app_feedback
      WHERE satisfaction = 1
      ORDER BY criado_em DESC
    `);

    if (res.rows.length === 0) {
      console.log('Nenhum feedback negativo encontrado.');
    } else {
      res.rows.forEach(r => {
        console.log(`[${r.criado_em.toISOString()}] Usuário: ${r.user_id} | Nota: ${r.satisfaction}`);
        console.log(`Comentário: ${r.comment || '(sem comentário)'}`);
        console.log('---');
      });
    }
  } catch (e) {
    console.error('Erro ao ler feedbacks:', e.message);
  } finally {
    process.exit(0);
  }
}

checkNegativeFeedback();
