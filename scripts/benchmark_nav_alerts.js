const path = require('path');
const { ecoPool } = require(path.join(__dirname, '../src/main/db'));

async function benchmark() {
    console.log('--- Benchmarking Navigation Alerts Query ---');
    
    // 1. Prepare data
    console.log('Preparing dummy data...');
    await ecoPool.query('DELETE FROM acoes_pendentes');
    
    // Insert 10,000 rows, some pending, some not
    const rows = [];
    for (let i = 0; i < 10000; i++) {
        const status = i % 2 === 0 ? 'PENDENTE' : 'CONCLUIDO';
        const tipo = i % 3 === 0 ? 'ALTERAR_CAMPO' : 'OUTRO';
        const origem = i % 4 === 0 ? 'MANUAL' : 'SISTEMA';
        const criado_em = new Date(Date.now() - (i % 24) * 3600000); // spread over 24 hours
        rows.push(`('cliente', 'id_${i}', 'p_${i}', 'Pessoa ${i}', '${tipo}', 'campo_${i}', 'velho', 'novo', 'motivo', '${origem}', 'user', '${criado_em.toISOString()}', '${status}')`);
    }
    
    const chunks = [];
    for (let i = 0; i < rows.length; i += 1000) {
        chunks.push(rows.slice(i, i + 1000));
    }
    
    for (const chunk of chunks) {
        await ecoPool.query(`
            INSERT INTO acoes_pendentes (entidade, id_entidade, idpessoa, nome_pessoa, tipo_acao, campo, valor_anterior, valor_novo, motivo, origem, criado_por, criado_em, status)
            VALUES ${chunk.join(',')}
        `);
    }
    console.log('10,000 rows inserted.');

    const urgencyHours = '4';

    // 2. Original Query
    console.log('\nRunning Original Query...');
    const start1 = Date.now();
    const res1 = await ecoPool.query(`
        EXPLAIN ANALYZE
        SELECT 
          COUNT(*) FILTER (WHERE tipo_acao = 'ALTERAR_CAMPO' AND COALESCE(status, 'PENDENTE') = 'PENDENTE') as sav_count,
          COUNT(*) FILTER (WHERE status = 'PENDENTE' AND (origem = 'MANUAL' AND criado_em < NOW() - ($1 || ' hours')::interval)) as sav_urgent
        FROM acoes_pendentes
    `, [urgencyHours]);
    const end1 = Date.now();
    console.log(res1.rows.map(r => r['QUERY PLAN']).join('\n'));
    console.log(`Original Time: ${end1 - start1}ms`);

    // 4. Specialized Index
    console.log('\nCreating specialized index...');
    await ecoPool.query("CREATE INDEX IF NOT EXISTS idx_acoes_nav_alerts_v3 ON acoes_pendentes (tipo_acao, origem, criado_em) WHERE status = 'PENDENTE'");
    
    console.log('Running Specialized Query...');
    const start3 = Date.now();
    const res3 = await ecoPool.query(`
        EXPLAIN ANALYZE
        SELECT 
          COUNT(*) FILTER (WHERE tipo_acao = 'ALTERAR_CAMPO') as sav_count,
          COUNT(*) FILTER (WHERE origem = 'MANUAL' AND criado_em < NOW() - ($1 || ' hours')::interval) as sav_urgent
        FROM acoes_pendentes
        WHERE status = 'PENDENTE'
    `, [urgencyHours]);
    const end3 = Date.now();
    console.log(res3.rows.map(r => r['QUERY PLAN']).join('\n'));
    console.log(`Specialized Time: ${end3 - start3}ms`);

    // Cleanup index
    await ecoPool.query("DROP INDEX IF EXISTS idx_acoes_nav_alerts_v3");
}

benchmark().catch(console.error);
