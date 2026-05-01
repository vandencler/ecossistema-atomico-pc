const { pool } = require('../src/main/db');

async function checkSearchPlan() {
  const query = 'JOAO';
  const tokens = [query.toLowerCase()];
  
  const params = [
    `%${query.toLowerCase()}%`, // $1
    query.toLowerCase(),       // $2
    query.trim()               // $3
  ];
  
  const rawIdx = 2;
  const trimIdx = 3;

  // Simulate what clientService.js does
  const conditions = tokens.map((token) => {
    const textParam = `%${token}%`;
    const fuzzyParam = token;
    
    const addParam = (val) => {
      params.push(String(val));
      return `$${params.length}::text`;
    };

    const subConditions = [];
    subConditions.push(`p.nmpessoa % ${addParam(fuzzyParam)}`);
    subConditions.push(`p.nmcurto % ${addParam(fuzzyParam)}`);
    subConditions.push(`LOWER(p.cdchamada) % ${addParam(fuzzyParam)}`);
    subConditions.push(`p.nrcgc_cic % ${addParam(fuzzyParam)}`);
    subConditions.push(`REGEXP_REPLACE(COALESCE(p.campostelwhatsapp,''), '[^0-9]', '', 'g') % ${addParam(fuzzyParam)}`);
    subConditions.push(`REGEXP_REPLACE(COALESCE(p.nrtelefone,''), '[^0-9]', '', 'g') % ${addParam(fuzzyParam)}`);

    return `(${subConditions.join(' OR ')})`;
  });

  const sql = `
    EXPLAIN ANALYZE
    SELECT p.idpessoa, p.cdchamada, p.nmpessoa, p.nmcurto, p.nrcgc_cic,
           p.email, p.nrtelefone, p.nrpager, p.campostelwhatsapp, p.stpessoa,
           t.dstabela AS tabela_preco,
           cr.dtdatanasc, cr.sexo,
           similarity(LOWER(p.nmpessoa), $${rawIdx}::text) as score
    FROM wshop.pessoas p
    LEFT JOIN wshop.tabelaprecos t ON p.idtabela = t.idtabela
    LEFT JOIN wshop.crediar cr ON cr.idpessoa = p.idpessoa
    WHERE ${conditions.join(' AND ')}
    ORDER BY 
      CASE 
        WHEN p.cdchamada = $${trimIdx}::text THEN 0
        WHEN LOWER(p.nmpessoa) = $${trimIdx}::text THEN 1
        WHEN LOWER(p.nmpessoa) LIKE $1::text THEN 2
        ELSE 4 
      END,
      score DESC
    LIMIT 25
  `;

  try {
    const res = await pool.query(sql, params);
    console.log(res.rows.map(r => r['QUERY PLAN']).join('\n'));
  } catch (e) {
    console.error(e.message);
  } finally {
    process.exit(0);
  }
}

checkSearchPlan();