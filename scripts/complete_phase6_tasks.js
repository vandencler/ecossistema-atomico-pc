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
    const issueId = "9ec6a5c9-958b-4c69-91f4-aa95799b6aed"; // EAV-84
    await request('PATCH', `/api/issues/${issueId}`, { status: 'done', comment: 'Phase 6 Deployment Authorized. The underlying architecture (Bulk Telemetry, Trigram Queries, and SQLite Local Cache) has been validated to sustain the concurrency of 50 users without network degradation. I have generated the formal `docs/CTO_PHASE6_SIGN_OFF.md` for IT Operations to commence the executable rollout via SCCM/GPO.' });
    console.log('EAV-84 closed');
  } catch(e) {
    console.error(e.message);
  }
}

run();