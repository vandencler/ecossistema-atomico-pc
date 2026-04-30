const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { readNumber } = require('./utils');

const LOCAL_CONFIG_PATH = path.join(__dirname, '..', '..', 'config.local.json');

function readLocalConfig() {
  try {
    if (!fs.existsSync(LOCAL_CONFIG_PATH)) return {};
    return JSON.parse(fs.readFileSync(LOCAL_CONFIG_PATH, 'utf8'));
  } catch (error) {
    console.error('Falha ao ler config.local.json:', error.message);
    return {};
  }
}

const localConfig = readLocalConfig();

const settings = {
  cacheTTL: readNumber(localConfig.settings?.cacheTTL, 24),
  autoSync: localConfig.settings?.autoSync === true,
  syncInterval: readNumber(localConfig.settings?.syncInterval, 5)
};

function readEnv(prefix, key) {
  return process.env[`ATOMICO_${prefix}_${key}`];
}

function dbConfig(configKey, envPrefix, fallback) {
  const fileConfig = localConfig.databases?.[configKey] || {};
  return {
    host: readEnv(envPrefix, 'HOST') || fileConfig.host || fallback.host,
    port: readNumber(readEnv(envPrefix, 'PORT') || fileConfig.port, fallback.port),
    database: readEnv(envPrefix, 'DATABASE') || fileConfig.database || fallback.database,
    user: readEnv(envPrefix, 'USER') || fileConfig.user || fallback.user,
    password: readEnv(envPrefix, 'PASSWORD') || fileConfig.password || fallback.password || '',
    connectionTimeoutMillis: readNumber(
      readEnv(envPrefix, 'CONNECTION_TIMEOUT') || fileConfig.connectionTimeoutMillis,
      fallback.connectionTimeoutMillis || 5000
    ),
    max: readNumber(readEnv(envPrefix, 'MAX') || fileConfig.max, fallback.max || 3)
  };
}

const pool = new Pool(dbConfig('mirror', 'MIRROR', {
  host: '127.0.0.1',
  port: 5432,
  database: 'ALTERDATA_SHOP_ESPELHO',
  user: 'postgres',
  max: 5
}));

pool.on('error', (err) => {
  console.error('Erro inesperado no Pool MIRROR:', err.message);
});

const ecoPool = new Pool(dbConfig('ecosystem', 'ECOSYSTEM', {
  host: '127.0.0.1',
  port: 5432,
  database: 'ECOSSISTEMA_ATOMICO',
  user: 'postgres',
  max: 3
}));

ecoPool.on('error', (err) => {
  console.error('Erro inesperado no Pool ECOSYSTEM:', err.message);
});

module.exports = {
  pool,
  ecoPool,
  settings
};
