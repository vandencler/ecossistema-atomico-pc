const { pool, ecoPool } = require('../src/main/db');

async function dispatchHygiene() {
  console.log('[DS-SAV] Iniciando despacho de ações de higiene para o desafio Mestre do Cadastro...');
  
  try {
    // 1. Get high-priority candidates (ABC A)
    const candidatesRes = await ecoPool.query(`
      SELECT rc.idpessoa, ce.score_engajamento, rc.abc
      FROM ranking_cache rc
      LEFT JOIN clientes_enriquecidos ce ON rc.idpessoa = ce.idpessoa
      WHERE rc.abc = 'A'
    `);
    const candidates = candidatesRes.rows;
    const candidateIds = candidates.map(c => c.idpessoa);

    if (candidateIds.length === 0) {
      console.log('[DS-SAV] Nenhum cliente ABC A encontrado no cache.');
      process.exit(0);
    }

    // 2. Fetch quality data from Mirror
    const qualityRes = await pool.query(`
      SELECT p.idpessoa, p.nmpessoa, p.nrtelefone, cr.sexo, cr.dtdatanasc
      FROM wshop.pessoas p
      LEFT JOIN wshop.crediar cr ON p.idpessoa = cr.idpessoa
      WHERE p.idpessoa = ANY($1::text[])
    `, [candidateIds]);

    const qualityMap = {};
    qualityRes.rows.forEach(r => { qualityMap[r.idpessoa] = r; });

    // 3. Filter and prepare actions
    const existingRes = await ecoPool.query("SELECT idpessoa FROM acoes_pendentes WHERE tipo_acao = 'CORRECAO_CADASTRO' AND status = 'PENDENTE'");
    const existingIds = new Set(existingRes.rows.map(r => r.idpessoa));

    const actionsToCreate = [];
    for (const cand of candidates) {
      if (existingIds.has(cand.idpessoa)) continue;

      const q = qualityMap[cand.idpessoa];
      if (!q) continue;

      const reasons = [];
      const phone = (q.nrtelefone || '').replace(/\D/g, '');
      if (!phone || (phone.length !== 10 && phone.length !== 11)) reasons.push('Telefone inválido/ausente');
      if (q.nrtelefone && /[^0-9]/.test(q.nrtelefone)) reasons.push('Caracteres estranhos no telefone');
      if (!q.sexo) reasons.push('Gênero não informado');
      if (!q.dtdatanasc) reasons.push('Data de nascimento ausente');

      if (reasons.length > 0) {
        actionsToCreate.push({
          idpessoa: q.idpessoa,
          nome_pessoa: q.nmpessoa,
          motivo: `[Mestre do Cadastro] Pendências: ${reasons.join(', ')}`,
          score: cand.score_engajamento || 0
        });
      }
    }

    console.log(`[DS-SAV] Preparando ${actionsToCreate.length} novas ações de correção.`);

    // 4. Batch insert (limited to 200 for now to avoid noise)
    const limit = 200;
    const batch = actionsToCreate.sort((a, b) => b.score - a.score).slice(0, limit);

    if (batch.length > 0) {
      const values = batch.map((_, idx) => `($${idx * 5 + 1}, $${idx * 5 + 2}, $${idx * 5 + 3}, $${idx * 5 + 4}, $${idx * 5 + 5}, 'CORRECAO_CADASTRO', 'SISTEMA', 'sistema')`).join(', ');
      const params = batch.flatMap(a => [a.idpessoa, a.nome_pessoa, a.motivo, 'cliente', a.idpessoa]);

      await ecoPool.query(`
        INSERT INTO acoes_pendentes (idpessoa, nome_pessoa, motivo, entidade, id_entidade, tipo_acao, origem, criado_por)
        VALUES ${values}
      `, params);
      
      console.log(`[DS-SAV] ${batch.length} ações criadas com sucesso.`);
    }

  } catch (err) {
    console.error('[DS-SAV] Erro:', err.message);
  } finally {
    process.exit(0);
  }
}

dispatchHygiene();
