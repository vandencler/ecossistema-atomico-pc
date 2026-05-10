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

const originalPoolBase = new Pool(dbConfig('production', 'PRODUCTION', {
  host: '192.168.2.103',
  port: 5432,
  database: 'ALTERDATA_SHOP',
  user: 'eav_updater',
  max: 3
}));

originalPoolBase.on('error', (err) => {
  console.error('Erro inesperado no Pool PRODUCTION:', err.message);
});

// Throttlers to prevent overloading the databases
const mirrorThrottler = new Throttler('MIRROR', settings.throttleMirror, 15);
const ecoThrottler = new Throttler('ECOSYSTEM', settings.throttleEco, 30);
const originalThrottler = new Throttler('PRODUCTION', 2, 60); // Very restrictive for production


// Proxy wrapper to track slow queries
function createPoolProxy(poolInstance, label) {
  return new Proxy(poolInstance, {
    get(target, prop) {
      const value = target[prop];
      if (typeof value === 'function' && prop === 'query') {
        return async (...args) => {
          const start = Date.now();
          try {
            const res = await value.apply(target, args);
            const duration = Date.now() - start;

            if (duration > 100 && label !== 'ecosystem' && process.env.NODE_ENV !== 'test') {
              try {
                // Late require to avoid circular dependencies
                const { trackEvent } = require('./services/telemetryService');
                trackEvent('SLOW_QUERY', 'system', {
                  duration,
                  pool: label,
                  sql: typeof args[0] === 'string' ? args[0].trim().slice(0, 150) : 'object_query'
                }).catch(() => {});
              } catch (_e) { /* ignore telemetry errors */ }
            }
            return res;
          } catch (err) {
            throw err;
          }
        };
      }
      return value;
    }
  });
}

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

const originalPool = {
  query: (text, params) => originalThrottler.run(() => originalPoolBase.query(text, params)),
  connect: () => originalPoolBase.connect(),
  raw: originalPoolBase,
  throttler: originalThrottler
};

const proxiedPool = createPoolProxy(pool, 'mirror');
const proxiedEcoPool = createPoolProxy(ecoPool, 'ecosystem');
const proxiedOriginalPool = createPoolProxy(originalPool, 'original');

module.exports = {
  pool: proxiedPool,
  ecoPool: proxiedEcoPool,
  originalPool: proxiedOriginalPool,
  settings
};
