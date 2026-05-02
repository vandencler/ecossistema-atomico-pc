
const cwd = process.cwd();
if (!cwd.toLowerCase().includes("-pc")) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error("This script MUST be executed from D:\projetos\ecossistema-atomico-pc");
    process.exit(1);
}

const { ecoPool } = require('../src/main/db');
async function run() {
    try {
        const res = await ecoPool.query("SELECT id, idpessoa, campo, valor_novo, status FROM acoes_pendentes WHERE status = 'PENDENTE' LIMIT 5");
        console.table(res.rows);
    } catch (e) {
        console.error(e.message);
    } finally {
        process.exit();
    }
}
run();
