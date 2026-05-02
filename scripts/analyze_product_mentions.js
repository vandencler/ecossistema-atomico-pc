const { ecoPool } = require('../src/main/db');

async function analyzeProductMentions() {
  console.log('[ML-PROD] Analisando menções de produtos nas mensagens...');
  
  try {
    const res = await ecoPool.query(`
      SELECT conteudo 
      FROM omnichannel_mensagens 
      WHERE direcao = 'INBOUND'
    `);

    if (res.rowCount === 0) {
      console.log('[ML-PROD] Nenhuma mensagem para analisar.');
      return;
    }

    // This is a simple keyword search. In a real scenario, we'd use a product catalog.
    // For now, let's just look for "produto", "preço", "venda", "entrega", etc.
    const keywords = ['produto', 'preço', 'valor', 'entrega', 'estoque', 'promoção', 'desconto'];
    const counts = {};
    keywords.forEach(k => counts[k] = 0);

    res.rows.forEach(r => {
      const msg = r.conteudo.toLowerCase();
      keywords.forEach(k => {
        if (msg.includes(k)) counts[k]++;
      });
    });

    console.log('Frequência de Menções:');
    console.table(counts);

  } catch (err) {
    console.error('[ML-PROD] Erro:', err.message);
  } finally {
    process.exit(0);
  }
}

analyzeProductMentions();
