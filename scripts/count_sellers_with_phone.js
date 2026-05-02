
const cwd = process.cwd();
if (!cwd.toLowerCase().includes("-pc")) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error("This script MUST be executed from D:\projetos\ecossistema-atomico-pc");
    process.exit(1);
}

const { pool } = require('../src/main/db');
pool.query("SELECT COUNT(*) FROM wshop.pessoas WHERE stvendedor = true AND (nrtelefone <> '' OR campostelwhatsapp IS NOT NULL)")
  .then(r => {
    console.log(r.rows[0]);
    process.exit(0);
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });