const { pool, ecoPool } = require('../src/main/db');

async function dryRun() {
  console.log('[DS] Analisando candidatos para o desafio Mestre do Cadastro...');
  
  try {
    // 1. Get ABC A clients from ranking_cache
    const highValueRes = await ecoPool.query("SELECT idpessoa, abc FROM ranking_cache WHERE abc = 'A'");
    const highValueIds = highValueRes.rows.map(r => r.idpessoa);
    
    if (highValueIds.length === 0) {
      console.log('[DS] ranking_cache está vazio. Execute o BulkIntelligenceService primeiro.');
      process.exit(0);
    }

    console.log(`[DS] Total de clientes ABC A: ${highValueIds.length}`);

    // 2. Query Mirror DB for data quality of these clients
    const qualityRes = await pool.query(`
      SELECT p.idpessoa, p.nmpessoa, p.nrtelefone, p.nrpager, cr.sexo, cr.dtdatanasc
      FROM wshop.pessoas p
      LEFT JOIN wshop.crediar cr ON p.idpessoa = cr.idpessoa
      WHERE p.idpessoa = ANY($1::text[])
    `, [highValueIds]);

    let dirtyCount = 0;
    const dirtyCandidates = [];

    qualityRes.rows.forEach(r => {
      let isDirty = false;
      const reasons = [];

      // Phone checks
      const phone = (r.nrtelefone || '').replace(/\D/g, '');
      const pager = (r.nrpager || '').replace(/\D/g, '');
      
      if (!phone || (phone.length !== 10 && phone.length !== 11)) {
        isDirty = true;
        reasons.push('Telefone inválido ou ausente');
      }
      
      if (r.nrtelefone && /[^0-9]/.test(r.nrtelefone)) {
        isDirty = true;
        reasons.push('Caracteres não numéricos no telefone');
      }

      if (!r.sexo) {
        isDirty = true;
        reasons.push('Gênero não informado');
      }

      if (!r.dtdatanasc) {
        isDirty = true;
        reasons.push('Data de nascimento ausente');
      }

      if (isDirty) {
        dirtyCount++;
        dirtyCandidates.push({
          idpessoa: r.idpessoa,
          nome: r.nmpessoa,
          reasons: reasons.join(', ')
        });
      }
    });

    console.log(`[DS] Encontrados ${dirtyCount} clientes ABC A com pendências de cadastro.`);
    console.log('Amostra de 10 candidatos:');
    console.table(dirtyCandidates.slice(0, 10));

  } catch (err) {
    console.error('[DS] Erro:', err.message);
  } finally {
    process.exit(0);
  }
}

dryRun();
