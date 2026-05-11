const { spawn } = require('child_process');
const path = require('path');
const { ecoPool } = require('../src/main/db');

/**
 * Infrastructure Manager for EAV
 * Stabilizes the DB Proxy and the Public Tunnel (Fixed Endpoint)
 */

const PROXY_PORT = 3000;
const PREFERRED_SUBDOMAIN = 'eav-proxy-atomico'; // Change this if needed

async function startProxy() {
  console.log('[INFRA] Starting DB Proxy API...');
  const proxyPath = path.join(__dirname, 'db_proxy_api.js');
  
  // Use 'node' to run the proxy script
  const proxy = spawn('node', [proxyPath], {
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'production' }
  });

  proxy.stdout.on('data', (data) => console.log(`[PROXY] ${data.toString().trim()}`));
  proxy.stderr.on('data', (data) => console.error(`[PROXY ERROR] ${data.toString().trim()}`));
  
  return proxy;
}

async function startTunnel() {
  console.log(`[INFRA] Starting Tunnel for port ${PROXY_PORT}...`);
  
  // Check for Cloudflare Token first
  const cfToken = process.env.CLOUDFLARE_TUNNEL_TOKEN;
  
  if (cfToken) {
    console.log('[INFRA] Using Cloudflare Named Tunnel with provided token.');
    const cf = spawn('cloudflared.exe', ['tunnel', '--no-autoupdate', 'run', '--token', cfToken], {
      stdio: 'pipe'
    });
    cf.stdout.on('data', (data) => console.log(`[CLOUDFLARE] ${data.toString().trim()}`));
    cf.stderr.on('data', (data) => console.log(`[CLOUDFLARE] ${data.toString().trim()}`));
    return cf;
  }

  // Fallback to Cloudflare Ephemeral Tunnel (trycloudflare.com)
  console.log(`[INFRA] No Cloudflare Token found. Falling back to Cloudflare Ephemeral Tunnel...`);
  
  const cf = spawn('cloudflared.exe', ['tunnel', '--url', `http://localhost:${PROXY_PORT}`], {
    stdio: 'pipe'
  });

  cf.stdout.on('data', async (data) => {
    const output = data.toString();
    console.log(`[CLOUDFLARE] ${output.trim()}`);
  });

  cf.stderr.on('data', async (data) => {
    const output = data.toString();
    console.log(`[CLOUDFLARE] ${output.trim()}`);
    
    if (output.includes('.trycloudflare.com')) {
      const urlMatch = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (urlMatch) {
        const url = urlMatch[0];
        console.log(`[INFRA] SUCCESS! Ephemeral Tunnel established at: ${url}`);
        
        // Update Database
        try {
          await ecoPool.query(`
            INSERT INTO config_sistema (chave, valor, descricao)
            VALUES ('public_proxy_url', $1, 'URL temporária do Proxy DB (Ephemeral)')
            ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = NOW()
          `, [url]);
          console.log('[INFRA] config_sistema.public_proxy_url updated.');
        } catch (e) {
          console.error('[INFRA] Database update failed:', e.message);
        }
      }
    }
  });
  
  return cf;
}

async function main() {
  const proxy = await startProxy();
  const tunnel = await startTunnel();

  console.log('[INFRA] Infrastructure components initialized.');

  // Handle termination
  const cleanup = () => {
    console.log('[INFRA] Shutting down...');
    proxy.kill();
    tunnel.kill();
    process.exit();
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

// Execute if run directly
if (require.main === module) {
  main().catch(err => {
    console.error('[INFRA FATAL ERROR]', err);
    process.exit(1);
  });
}

module.exports = { main };
