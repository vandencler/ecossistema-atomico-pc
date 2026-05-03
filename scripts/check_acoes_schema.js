const { ecoPool } = require('../src/main/db');
async function run() {
    try {
        const res = await ecoPool.query("SELECT column_name, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'acoes_pendentes' AND column_name = 'status'");
        console.table(res.rows);
    } catch (e) {
        console.error('Check failed:', e.message);
    } finally {
        process.exit();
    }
}
run();
