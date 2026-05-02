
const cwd = process.cwd();
if (!cwd.toLowerCase().includes("-pc")) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    process.exit(1);
}
const { ecoPool } = require('../src/main/db');
async function run() {
    try {
        console.log('Auditing recent telemetry for errors...');
        const res = await ecoPool.query("SELECT * FROM log_eventos WHERE tipo LIKE '%ERROR%' AND criado_em > NOW() - INTERVAL '24 hours' ORDER BY criado_em DESC");
        console.table(res.rows.map(r => ({
            id: r.id,
            tipo: r.tipo,
            idpessoa: r.idpessoa,
            detalhe: r.detalhe.substring(0, 100),
            criado_em: r.criado_em
        })));
    } catch (e) {
        console.error('Audit failed:', e.message);
    } finally {
        process.exit();
    }
}
run();
