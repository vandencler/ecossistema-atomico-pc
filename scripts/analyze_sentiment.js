const { ecoPool } = require('../src/main/db');

async function analyzeSentiment() {
  console.log('[ML-SENTIMENT] Iniciando analise de sentimento das mensagens...');
  
  try {
    // 1. Fetch recent inbound messages
    const res = await ecoPool.query(`
      SELECT idpessoa, conteudo, criado_em
      FROM omnichannel_mensagens
      WHERE direcao = 'INBOUND' AND status = 'RECEIVED'
      ORDER BY criado_em DESC
    `);

    if (res.rowCount === 0) {
      console.log('[ML-SENTIMENT] Nenhuma mensagem pendente para analise.');
      return;
    }

    const negWords = ['lento', 'travando', 'erro', 'ruim', 'dificil', 'bug', 'parou', 'problema', 'pessimo', 'atraso', 'falha', 'horrível', 'limitado', 'confuso', 'complicado'];
    const posWords = ['rapido', 'facil', 'ajudou', 'bom', 'parabens', 'top', 'otimo', 'excelente', 'vendi', 'sucesso', 'amando', 'perfeito', 'incrível', 'parabéns', 'agilidade'];

    // 2. Fetch recent UX feedback (Manual APP Feedbacks)
    const uxRes = await ecoPool.query(`
      SELECT user_id as idpessoa, satisfaction, comment, criado_em
      FROM app_feedback
      WHERE criado_em > CURRENT_TIMESTAMP - INTERVAL '30 days'
    `);

    const clientData = {}; // { idpessoa: { messages: [], ux_scores: [], last_at } }

    res.rows.forEach(r => {
      if (!clientData[r.idpessoa]) {
        clientData[r.idpessoa] = { messages: [], ux_scores: [], last_at: r.criado_em };
      }
      clientData[r.idpessoa].messages.push({ text: r.conteudo.toLowerCase(), date: r.criado_em });
    });

    uxRes.rows.forEach(r => {
      if (!clientData[r.idpessoa]) {
        clientData[r.idpessoa] = { messages: [], ux_scores: [], last_at: r.criado_em };
      }
      // Map satisfaction 1 -> -1, 2 -> 0, 3 -> 1
      const mappedScore = r.satisfaction === 1 ? -1 : (r.satisfaction === 3 ? 1 : 0);
      clientData[r.idpessoa].ux_scores.push({ score: mappedScore, date: r.criado_em });
      if (r.comment) {
        clientData[r.idpessoa].messages.push({ text: r.comment.toLowerCase(), date: r.criado_em });
      }
      if (r.criado_em > clientData[r.idpessoa].last_at) {
        clientData[r.idpessoa].last_at = r.criado_em;
      }
    });

    const client = await ecoPool.raw.connect();
    try {
      await client.query('BEGIN');
      let analyzedCount = 0;

      for (const idp in clientData) {
        const { messages, ux_scores, last_at } = clientData[idp];
        let totalScore = 0;
        let totalWeight = 0;

        const now = new Date();

        // Process Messages with Time Decay
        messages.forEach(msg => {
          let msgScore = 0;
          let negHits = 0;
          let posHits = 0;
          
          negWords.forEach(w => { if (msg.text.includes(w)) negHits++; });
          posWords.forEach(w => { if (msg.text.includes(w)) posHits++; });

          if (negHits > posHits) msgScore = -1;
          else if (posHits > negHits) msgScore = 1;
          
          if (msgScore !== 0) {
            // Recency weighting: 1.0 for < 24h, decays to 0.2 over 30 days
            const ageDays = (now - new Date(msg.date)) / (1000 * 60 * 60 * 24);
            const weight = Math.max(0.2, 1.0 - (ageDays / 30));
            totalScore += msgScore * weight;
            totalWeight += weight;
          }
        });

        // Process UX Scores
        ux_scores.forEach(ux => {
          const ageDays = (now - new Date(ux.date)) / (1000 * 60 * 60 * 24);
          const weight = Math.max(0.4, 1.2 - (ageDays / 30)); // UX feedback has higher weight
          totalScore += ux.score * weight;
          totalWeight += weight;
        });

        const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
        const label = finalScore < -0.2 ? 'NEGATIVE' : (finalScore > 0.2 ? 'POSITIVE' : 'NEUTRAL');

        await client.query(`
          INSERT INTO ml_client_sentiment (idpessoa, sentiment_score, sentiment_label, last_message_at)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (idpessoa) DO UPDATE SET
            sentiment_score = EXCLUDED.sentiment_score,
            sentiment_label = EXCLUDED.sentiment_label,
            last_message_at = EXCLUDED.last_message_at,
            calculado_em = CURRENT_TIMESTAMP
        `, [idp, finalScore.toFixed(2), label, last_at]);
        analyzedCount++;
      }

      await client.query('COMMIT');
      console.log(`[ML-SENTIMENT] Analise concluida para ${analyzedCount} clientes.`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[ML-SENTIMENT] Erro fatal:', err.message);
  }
}

async function run() {
  await analyzeSentiment();
  process.exit(0);
}

run();
