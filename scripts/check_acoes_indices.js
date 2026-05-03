const { ecoPool } = require("../src/main/db");
async function run() {
    try {
        console.log("Checking indices on acoes_pendentes...");
        const res = await ecoPool.query("SELECT indexname FROM pg_indexes WHERE tablename = 'acoes_pendentes'");
        console.table(res.rows);
    } catch (e) {
        console.error("Check failed:", e.message);
    } finally {
        process.exit();
    }
}
run();
