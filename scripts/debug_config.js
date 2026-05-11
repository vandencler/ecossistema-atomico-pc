const fs = require('fs');
try {
    const config = JSON.parse(fs.readFileSync('D:/projetos/ecossistema-atomico-pc/config.local.json', 'utf8'));
    console.log('Mirror:', config.databases.mirror.host, config.databases.mirror.port, config.databases.mirror.database);
    console.log('Ecosystem:', config.databases.ecosystem.host, config.databases.ecosystem.port, config.databases.ecosystem.database);
} catch (e) {
    console.error(e.message);
}
