const { ecoPool } = require("../src/main/db");
const { performSync } = require("../src/main/services/syncService");
async function run() {
    try {
        console.log("Fetching approved actions...");
        const res = await ecoPool.query("SELECT id FROM acoes_pendentes WHERE status = 'APROVADO'");
        const ids = res.rows.map(r => r.id);
        console.log(`Found ${ids.length} approved actions:`, ids);
        
        if (ids.length > 0) {
            const result = await performSync(ids, { usuario: 'smoke-test' });
            console.log("Sync Result:", JSON.stringify(result, null, 2));
        }
    } catch (e) {
        console.error("Sync failed:", e.message);
    } finally {
        process.exit();
    }
}
run();
