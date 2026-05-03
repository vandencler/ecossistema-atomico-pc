const { ecoPool } = require("../src/main/db");
async function run() {
    try {
        console.log("Checking for recent errors in telemetry (last 15m)...");
        const res = await ecoPool.query(`
            SELECT tipo, idpessoa, detalhe, criado_em 
            FROM log_eventos 
            WHERE criado_em > NOW() - INTERVAL '15 minutes'
              AND (tipo LIKE '%ERROR%' OR tipo LIKE '%FAIL%')
            ORDER BY criado_em DESC
        `);
        console.table(res.rows);
    } catch (e) {
        console.error("Check failed:", e.message);
    } finally {
        process.exit();
    }
}
run();
