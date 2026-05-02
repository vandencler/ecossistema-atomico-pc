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
