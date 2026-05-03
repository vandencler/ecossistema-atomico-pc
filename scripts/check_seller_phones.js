
const cwd = process.cwd();
if (!cwd.toLowerCase().includes("-pc")) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    process.exit(1);
}

const { pool } = require('../src/main/db');

async function check() {
  const sellers = [
    'CLAUDIA MOYA',
    'LORENA TAFARELLO BATISTA',
    'LUAN',
    'PROF. JOELSON MORA',
    'RENAN SILVA TARCITANI',
    'SEM ATENDIMENTO'
  ];

  console.log('=== Checking Onboarding Blockers (Full Detail) ===');
  try {
    const res = await pool.query(`
      SELECT nmpessoa, nrtelefone, campostelwhatsapp, nrpager, stvendedor, stativo, idpessoa
      FROM wshop.pessoas
      WHERE nmpessoa = ANY($1::text[])
    `, [sellers]);

    console.table(res.rows.map(r => ({
      ID: r.idpessoa,
      Name: r.nmpessoa,
      Seller: r.stvendedor,
      Active: r.stativo,
      Phone: !!(r.nrtelefone || r.campostelwhatsapp || r.nrpager)
    })));

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

check();
