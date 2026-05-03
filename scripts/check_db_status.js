const { getDbStatus } = require('../src/main/services/configService');
async function run() {
    try {
        const status = await getDbStatus();
        console.log(JSON.stringify(status, null, 2));
    } catch (e) {
        console.error(e.message);
    } finally {
        process.exit();
    }
}
run();
