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
    const issueId = "398c8582-b9e4-4b3b-9769-a8dcaeae62fc"; // EAV-87
    await request('POST', `/api/issues/${issueId}/checkout`, { agentId, expectedStatuses: ["in_progress"] });
    console.log('EAV-87 checked out');
  } catch(e) {
    console.error(e.message);
  }
}

run();