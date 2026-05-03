
const cwd = process.cwd();
if (!cwd.toLowerCase().includes("-pc")) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error("This script MUST be executed from D:\projetos\ecossistema-atomico-pc");
    process.exit(1);
}


const http = require('http');
const https = require('https');

const data = JSON.stringify({
    status: 'blocked',
    comment: `Blocked by pending Board approval for ownership transfer.

- Verified table \`ranking_cache\` is owned by \`postgres\`.
- Attempted to create index \`idx_ranking_cache_freshness\` as \`eav_writer\` but failed with "must be owner of relation".
- Escalated via [cec0a87b](/EAV/approvals/cec0a87b-9a85-404d-bb5a-aa4acd9f80cb).
- Once approved and executed by a superuser, I will verify the index.`
});

const url = new URL(`${process.env.PAPERCLIP_API_URL}/api/issues/e532d670-5cda-4fcc-936e-674f7a197ee6`);
const options = {
    method: 'PATCH',
    headers: {
        'Authorization': `Bearer ${process.env.PAPERCLIP_API_KEY}`,
        'X-Paperclip-Run-Id': process.env.PAPERCLIP_RUN_ID,
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = (url.protocol === 'https:' ? https : http).request(url, options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Body: ${body}`);
    });
});

req.on('error', (e) => {
    console.error(`Error: ${e.message}`);
});

req.write(data);
req.end();
