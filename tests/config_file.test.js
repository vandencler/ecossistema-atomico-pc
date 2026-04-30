const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const proxyquire = require('proxyquire');

const TEST_CONFIG_PATH = path.join(__dirname, 'test.config.json');

const mockDb = {
  pool: {},
  ecoPool: {}
};

const configService = proxyquire('../src/main/services/configService', {
  '../db': mockDb,
  'path': {
    ...path,
    join: (...args) => {
      if (args[args.length - 1] === 'config.local.json') return TEST_CONFIG_PATH;
      return path.join(...args);
    }
  }
});

test('Config File Service - Security and Persistence', async (t) => {
  // Setup initial config with passwords
  const initialConfig = {
    databases: {
      mirror: { host: 'localhost', password: 'secret_mirror' },
      ecosystem: { host: 'localhost', password: 'secret_eco' }
    },
    settings: { autoSync: true }
  };
  fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(initialConfig));

  await t.test('getConfig - should strip passwords', () => {
    const safeConfig = configService.getConfig();
    assert.strictEqual(safeConfig.databases.mirror.password, undefined);
    assert.strictEqual(safeConfig.databases.ecosystem.password, undefined);
    assert.strictEqual(safeConfig.databases.mirror.host, 'localhost');
  });

  await t.test('saveConfig - should preserve existing passwords if not provided', async () => {
    const update = {
      settings: { autoSync: false }
    };
    await configService.saveConfig(update);
    
    const rawConfig = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'));
    assert.strictEqual(rawConfig.databases.mirror.password, 'secret_mirror');
    assert.strictEqual(rawConfig.databases.ecosystem.password, 'secret_eco');
    assert.strictEqual(rawConfig.settings.autoSync, false);
  });

  await t.test('saveConfig - should update password if provided', async () => {
    const update = {
      databases: {
        mirror: { password: 'new_secret' }
      }
    };
    await configService.saveConfig(update);
    
    const rawConfig = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'));
    assert.strictEqual(rawConfig.databases.mirror.password, 'new_secret');
    assert.strictEqual(rawConfig.databases.ecosystem.password, 'secret_eco');
  });

  // Cleanup
  if (fs.existsSync(TEST_CONFIG_PATH)) fs.unlinkSync(TEST_CONFIG_PATH);
});
