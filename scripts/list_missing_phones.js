
const cwd = process.cwd();
if (!cwd.toLowerCase().includes('-pc')) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error('This script MUST be executed from D:\projetos\ecossistema-atomico-pc');
    process.exit(1);
}

const { pool } = require('../src/main/db');

async function listMissing() {
  console.log('--- Vendedores Sem Telefone (Fase 6 Check) ---');
  try {
    const res = await pool.query(`
      SELECT idpessoa, nmpessoa, stpessoa 
      FROM wshop.pessoas 
      WHERE stvendedor = true 
        AND COALESCE(nrtelefone, '') = '' 
        AND campostelwhatsapp IS NULL 
        AND COALESCE(nrpager, '') = ''
      ORDER BY nmpessoa
    `);
    
    if (res.rows.length === 0) {
      console.log('Todos os vendedores ativos possuem telefone.');
    } else {
      res.rows.forEach(r => {
        console.log(`ID: ${r.idpessoa} | Nome: ${r.nmpessoa}`);
      });
      console.log(`Total: ${res.rows.length}`);
    }
  } catch (e) {
    console.error('Erro:', e.message);
  } finally {
    process.exit(0);
  }
}

listMissing();
