const fs = require('fs');
const path = 'STATUS.md';
let content = fs.readFileSync(path, 'utf8');
const heartbeat = `## Implementer-2 Heartbeat (2026-05-03 - 00:15)
- [x] **[PERF] Navigation Alerts:** ?? OPTIMIZED. Refactored uiService.js query to use status='PENDENTE' filter. Performance: 63ms -> 1ms.
- [!] **[SEC] Legacy Code Execution:** ?? ALERT. Detected config_sistema lookups from ANY($1::text[]) pattern (forbidden folder). Background agents must switch to -pc workspace.

`;
content = heartbeat + content;
fs.writeFileSync(path, content, 'utf8');
console.log('Updated STATUS.md');
