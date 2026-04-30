
const { pool } = require('../db');
const { getLocalDb } = require('../localDb');
const { logEvent, logError } = require('./logService');

async function warmUpCache() {
  console.log('[CACHE] Iniciando warm-up do cache local...');
  try {
    const db = getLocalDb();
    
    // Fetch top 1000 active clients
    const topClients = await pool.query(`
      SELECT p.idpessoa, p.nmpessoa, p.nmcurto, p.nrcgc_cic, p.dtultimacompra
      FROM wshop.pessoas p
      WHERE p.stpessoa != 'E' -- Exclude inactive if needed
      ORDER BY p.dtultimacompra DESC NULLS LAST
      LIMIT 1000
    `);

    const insert = db.prepare(`
      INSERT OR REPLACE INTO client_cache (idpessoa, nmpessoa, nmcurto, nrcgc_cic, dtultimacompra)
      VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((clients) => {
      for (const client of clients) {
        insert.run(
          client.idpessoa,
          client.nmpessoa,
          client.nmcurto,
          client.nrcgc_cic,
          client.dtultimacompra ? new Date(client.dtultimacompra).toISOString() : null
        );
      }
    });

    transaction(topClients.rows);
    
    await logEvent('CACHE_WARMUP', '0', `Cache local populado com ${topClients.rowCount} clientes.`);
    console.log(`[CACHE] Warm-up concluído: ${topClients.rowCount} clientes cacheados.`);
  } catch (e) {
    console.error('[CACHE] Erro no warm-up:', e.message);
    await logError('CACHE_WARMUP', e);
  }
}

async function searchLocalCache(query) {
  try {
    const db = getLocalDb();
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return { rows: [] };

    // Simple SQLite search logic
    const conditions = tokens.map(() => `(nmpessoa LIKE ? OR nmcurto LIKE ? OR nrcgc_cic LIKE ?)`).join(' AND ');
    const params = [];
    tokens.forEach(token => {
      const p = `%${token}%`;
      params.push(p, p, p);
    });

    const rows = db.prepare(`
      SELECT * FROM client_cache 
      WHERE ${conditions}
      LIMIT 25
    `).all(...params);

    return { rows: rows.map(r => ({ ...r, _source: 'cache' })) };
  } catch (e) {
    console.error('[CACHE] Erro na busca local:', e.message);
    return { error: e.message };
  }
}

module.exports = {
  warmUpCache,
  searchLocalCache
};
