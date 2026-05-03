const { ecoPool } = require("../src/main/db");
async function run() {
    try {
        console.log("Testing original query performance...");
        const start1 = Date.now();
        await ecoPool.query(`
          SELECT
            COUNT(*) FILTER (WHERE tipo_acao = 'ALTERAR_CAMPO' AND COALESCE(status, 'PENDENTE') = 'PENDENTE') as sav_count,
            COUNT(*) FILTER (WHERE status = 'PENDENTE' AND (origem = 'MANUAL' AND criado_em < NOW() - ('4' || ' hours')::interval)) as sav_urgent
          FROM acoes_pendentes
        `);
        const duration1 = Date.now() - start1;
        console.log(`Original duration: ${duration1}ms`);

        console.log("Testing optimized query performance...");
        const start2 = Date.now();
        await ecoPool.query(`
          SELECT
            COUNT(*) FILTER (WHERE tipo_acao = 'ALTERAR_CAMPO') as sav_count,
            COUNT(*) FILTER (WHERE origem = 'MANUAL' AND criado_em < NOW() - ('4' || ' hours')::interval) as sav_urgent
          FROM acoes_pendentes
          WHERE status = 'PENDENTE'
        `);
        const duration2 = Date.now() - start2;
        console.log(`Optimized duration: ${duration2}ms`);

    } catch (e) {
        console.error("Test failed:", e.message);
    } finally {
        process.exit();
    }
}
run();
