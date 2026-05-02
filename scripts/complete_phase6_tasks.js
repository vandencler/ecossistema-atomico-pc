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
  const tasks = [
    { id: 'b2e15c36-7ba7-4462-a6b6-ad6478ef2f2e', status: 'done', comment: 'Telemetry Identity implemented. System now supports OS username fallback and manual override in Settings. Persisted in `config_sistema`.', expected: ['in_progress'], name: 'EAV-108' },
    { id: 'e444afef-7092-428d-bccf-8603aa350a4c', status: 'done', comment: 'WhatsApp Onboarding messages configured in OmnichannelService.js and seeded in database.', expected: ['in_progress'], name: 'EAV-103' },
    { id: '3654a02d-4eaf-42d2-b1dc-732aa5a726f9', status: 'done', comment: 'Support Link and WhatsApp Support button added to Settings tab. CSS and HTML updated for consistent UI.', expected: ['backlog', 'todo'], name: 'EAV-107' },
    { id: '62372f88-51f7-41a4-9669-0dfa02476721', status: 'done', comment: 'Duplicate of [EAV-107](/EAV/issues/EAV-107). Closed as part of UI standardization.', expected: ['in_progress'], name: 'EAV-104' },
    { id: '9dee43ea-2cc9-4568-9eca-8c58ee0ce62f', status: 'done', comment: 'Onboarding Cheat Sheet and FAQ approved and verified in `docs/onboarding/`.', expected: ['in_review'], name: 'EAV-101' }
  ];

  for (const task of tasks) {
    try {
      await request('POST', `/api/issues/${task.id}/checkout`, { agentId, expectedStatuses: task.expected });
      await request('PATCH', `/api/issues/${task.id}`, { status: task.status, comment: task.comment });
      console.log(`${task.name} handled`);
    } catch(e) {
      console.log(`Skipping ${task.name}: ${e.message}`);
    }
  }
  console.log('All applicable Phase 6 readiness tasks processed');
}

run();