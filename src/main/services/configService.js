const { pool, ecoPool } = require('../db');
const fs = require('fs');
const path = require('path');

const LOCAL_CONFIG_PATH = path.join(__dirname, '..', '..', '..', 'config.local.json');

// --- Cache State ---
let rawConfigCache = null;
let safeConfigCache = null;
const systemConfigCache = new Map();
let systemConfigsListCache = null;

async function getDbStatus() {
  const status = {
    mirror: { status: 'ERROR', error: 'Não verificado' },
    ecosystem: { status: 'ERROR', error: 'Não verificado' }
  };

  try {
    const mirrorRes = await pool.query('SELECT version()');
    status.mirror = { status: 'OK', version: mirrorRes.rows[0].version };
  } catch (e) {
    status.mirror = { status: 'ERROR', error: e.message };
  }

  try {
    const ecoRes = await ecoPool.query('SELECT version()');
    status.ecosystem = { status: 'OK', version: ecoRes.rows[0].version };
  } catch (e) {
    status.ecosystem = { status: 'ERROR', error: e.message };
  }

  return status;
}

// --- Local File Config (config.local.json) ---

function _readRawConfig() {
  if (rawConfigCache) return JSON.parse(JSON.stringify(rawConfigCache));
  try {
    if (!fs.existsSync(LOCAL_CONFIG_PATH)) return {};
    rawConfigCache = JSON.parse(fs.readFileSync(LOCAL_CONFIG_PATH, 'utf8'));
    return JSON.parse(JSON.stringify(rawConfigCache));
  } catch (error) {
    console.error('Falha ao ler config.local.json raw:', error.message);
    return {};
  }
}

function getConfig() {
  if (safeConfigCache) return JSON.parse(JSON.stringify(safeConfigCache));
  
  const config = _readRawConfig();
  
  // Strip passwords for UI safety
  const safeConfig = JSON.parse(JSON.stringify(config));
  if (safeConfig.databases?.mirror) delete safeConfig.databases.mirror.password;
  if (safeConfig.databases?.ecosystem) delete safeConfig.databases.ecosystem.password;
  
  safeConfigCache = safeConfig;
  return safeConfig;
}

async function saveConfig(newConfig) {
  try {
    if (!newConfig || typeof newConfig !== 'object') throw new Error('Configuração inválida');
    
    const current = _readRawConfig(); // Read raw to preserve passwords
    
    const updated = {
      databases: {
        mirror: { ...(current.databases?.mirror || {}), ...(newConfig.databases?.mirror || {}) },
        ecosystem: { ...(current.databases?.ecosystem || {}), ...(newConfig.databases?.ecosystem || {}) }
      },
      settings: { ...(current.settings || {}), ...(newConfig.settings || {}) }
    };

    // Restore passwords if they were omitted in the update (likely because UI doesn't see them)
    if (newConfig.databases?.mirror && !newConfig.databases.mirror.password && current.databases?.mirror?.password) {
      updated.databases.mirror.password = current.databases.mirror.password;
    }
    if (newConfig.databases?.ecosystem && !newConfig.databases.ecosystem.password && current.databases?.ecosystem?.password) {
      updated.databases.ecosystem.password = current.databases.ecosystem.password;
    }

    fs.writeFileSync(LOCAL_CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf8');
    
    // Invalidate cache
    rawConfigCache = null;
    safeConfigCache = null;
    
    return { ok: true };
  } catch (error) {
    console.error('Falha ao salvar config.local.json:', error.message);
    return { ok: false, error: error.message };
  }
}

// --- DB-based Config (config_sistema table) ---

async function getSystemConfigs() {
  if (systemConfigsListCache) return JSON.parse(JSON.stringify(systemConfigsListCache));
  try {
    const res = await ecoPool.query('SELECT chave, valor, descricao FROM config_sistema ORDER BY chave');
    
    // Populate individual caches
    for (const row of res.rows) {
      systemConfigCache.set(row.chave, row.valor);
    }
    
    systemConfigsListCache = { rows: res.rows };
    return JSON.parse(JSON.stringify(systemConfigsListCache));
  } catch (e) {
    return { error: e.message };
  }
}

async function setSystemConfig(chave, valor) {
  try {
    await ecoPool.query(`
      INSERT INTO config_sistema (chave, valor, atualizado_em)
      VALUES ($1, $2, NOW())
      ON CONFLICT (chave) DO UPDATE SET
        valor = EXCLUDED.valor,
        atualizado_em = NOW()
    `, [chave, String(valor)]);
    
    // Invalidate cache
    systemConfigsListCache = null;
    systemConfigCache.delete(chave);
    
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
}

async function getConfigValue(chave, fallback) {
  if (systemConfigCache.has(chave)) {
    const cached = systemConfigCache.get(chave);
    return cached === undefined ? fallback : cached;
  }
  try {
    const res = await ecoPool.query('SELECT valor FROM config_sistema WHERE chave = $1', [chave]);
    if (res.rows.length === 0) {
      systemConfigCache.set(chave, undefined);
      return fallback;
    }
    const valor = res.rows[0].valor;
    systemConfigCache.set(chave, valor);
    return valor;
  } catch {
    return fallback;
  }
}

function validateConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Configuracao invalida');
  }

  if (config.databases !== undefined) {
    if (!config.databases || typeof config.databases !== 'object' || Array.isArray(config.databases)) {
      throw new Error('Configuracao de bancos invalida');
    }

    for (const key of Object.keys(config.databases)) {
      if (!['mirror', 'ecosystem'].includes(key)) throw new Error(`Banco nao permitido: ${key}`);
      const db = config.databases[key];
      if (!db || typeof db !== 'object' || Array.isArray(db)) throw new Error(`Config invalida para ${key}`);

      for (const textKey of ['host', 'database', 'user', 'password']) {
        if (db[textKey] !== undefined && (typeof db[textKey] !== 'string' || db[textKey].length > 200)) {
          throw new Error(`${key}.${textKey} invalido`);
        }
      }

      if (db.port !== undefined) {
        const port = Number(db.port);
        if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`${key}.port invalido`);
      }
    }
  }

  if (config.settings !== undefined) {
    if (!config.settings || typeof config.settings !== 'object' || Array.isArray(config.settings)) {
      throw new Error('Configuracao de app invalida');
    }
    if (config.settings.autoSync !== undefined && typeof config.settings.autoSync !== 'boolean') {
      throw new Error('settings.autoSync invalido');
    }
    for (const numericKey of ['cacheTTL', 'syncInterval', 'userId']) {
      if (config.settings[numericKey] !== undefined) {
        const value = Number(config.settings[numericKey]);
        if (!Number.isFinite(value) || value < 1 || value > 10080) throw new Error(`settings.${numericKey} invalido`);
      }
    }
  }

  return config;
}

module.exports = {
  getDbStatus,
  getConfig,
  saveConfig,
  getSystemConfigs,
  setSystemConfig,
  getConfigValue,
  validateConfig
};

