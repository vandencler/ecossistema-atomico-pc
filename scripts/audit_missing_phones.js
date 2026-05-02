const { pool } = require("../src/main/db");
async function run() {
    try {
        const res = await pool.query("SELECT idpessoa, nmpessoa, nrtelefone, campostelwhatsapp, nrpager FROM wshop.pessoas WHERE stvendedor = true AND COALESCE(nrtelefone, '') = '' AND campostelwhatsapp IS NULL AND COALESCE(nrpager, '') = ''");
        console.table(res.rows);
    } catch (e) {
        console.error(e.message);
    } finally {
        process.exit();
    }
}
run();
