const fs = require('fs');
const data = JSON.parse(fs.readFileSync('D:/projetos/ecossistema-atomico-pc/temp_issues.json', 'utf16le'));
const issue = data.find(i => i.identifier === 'EAV-83');
console.log(issue.description);
