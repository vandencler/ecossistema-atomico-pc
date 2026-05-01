const http = require('http');

const runId = process.env.PAPERCLIP_RUN_ID;
const apiKey = process.env.PAPERCLIP_API_KEY;
const apiUrl = process.env.PAPERCLIP_API_URL;
const agentId = process.env.PAPERCLIP_AGENT_ID;

async function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(apiUrl + path);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Paperclip-Run-Id': runId,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data ? JSON.parse(data) : null);
        } else {
          reject(new Error(`API Error ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  try {
    // EAV-81: UI Component Library Integration
    const issueId81 = "dfe23440-d152-4dd9-8837-482fe594d905";
    await request('POST', `/api/issues/${issueId81}/checkout`, { agentId, expectedStatuses: ["in_progress"] });
    await request('PATCH', `/api/issues/${issueId81}`, { status: 'done', comment: 'Integration complete. I verified that `src/js/ui/components.js` acts as the single source of truth for UI primitives (`MetricCard`, `StatusBadge`, `ActionGroup`, `IconButton`, `DiffBox`). Both `clientes.js` and `sav.js` consume these standardized components exclusively, ensuring a cohesive and modern visual language across the platform.' });
    console.log('EAV-81 closed');

    // EAV-82: Report Export Rollout
    const issueId82 = "0043aea6-d690-4d36-b5e0-3b05d6473a66";
    await request('POST', `/api/issues/${issueId82}/checkout`, { agentId, expectedStatuses: ["in_progress"] });
    await request('PATCH', `/api/issues/${issueId82}`, { status: 'done', comment: 'Rollout complete. The `exportService.js` natively generates PDF and Excel formats using `pdfmake` and `exceljs`. These capabilities are exposed via IPC and accessible in the Client Dashboard header, allowing the sales team to extract insights offline. Tests are passing and build packaging has been verified.' });
    console.log('EAV-82 closed');

    console.log('All Phase 4 tasks handled');
  } catch(e) {
    console.error(e.message);
  }
}

run();