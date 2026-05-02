const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { readNumber } = require('./utils');
const Throttler = require('./db/throttler');

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
  syncInterval: readNumber(localConfig.settings?.syncInterval, 5),
  throttleMirror: readNumber(localConfig.settings?.throttleMirror, 4),
  throttleEco: readNumber(localConfig.settings?.throttleEco, 8)
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
    max: readNumber(readEnv(envPrefix, 'MAX') || fileConfig.max, fallback.max || 5)
  };
}

const mirrorPool = new Pool(dbConfig('mirror', 'MIRROR', {
  host: '127.0.0.1',
  port: 5432,
  database: 'ALTERDATA_SHOP_ESPELHO',
  user: 'postgres',
  max: 5
}));

mirrorPool.on('error', (err) => {
  console.error('Erro inesperado no Pool MIRROR:', err.message);
});

const ecoPoolBase = new Pool(dbConfig('ecosystem', 'ECOSYSTEM', {
  host: '127.0.0.1',
  port: 5432,
  database: 'ECOSSISTEMA_ATOMICO',
  user: 'postgres',
  max: 10
}));

ecoPoolBase.on('error', (err) => {
  console.error('Erro inesperado no Pool ECOSYSTEM:', err.message);
});

// Throttlers to prevent overloading the databases
const mirrorThrottler = new Throttler('MIRROR', settings.throttleMirror, 15);
const ecoThrottler = new Throttler('ECOSYSTEM', settings.throttleEco, 30);

const pool = {
  query: (text, params) => mirrorThrottler.run(() => mirrorPool.query(text, params)),
  connect: () => mirrorPool.connect(),
  raw: mirrorPool,
  throttler: mirrorThrottler
};

const ecoPool = {
  query: (text, params) => ecoThrottler.run(() => ecoPoolBase.query(text, params)),
  connect: () => ecoPoolBase.connect(),
  raw: ecoPoolBase,
  throttler: ecoThrottler
};

module.exports = {
  pool,
  ecoPool,
  settings
};
