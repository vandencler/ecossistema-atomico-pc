const test = require('node:test');
const assert = require('node:assert');
const proxyquire = require('proxyquire');

process.env.NODE_ENV = 'test';

// Mocking dependencies

test('logEvent - should not throw if DB query fails', async () => {
  const failingPool = {
    query: async () => { throw new Error('DB Down'); }
  };
  const { logEvent: failingLogEvent } = proxyquire('../src/main/services/logService', {
    '../db': { ecoPool: failingPool },
    'fs': { appendFileSync: () => {} }
  });

  // Should not throw
  await failingLogEvent('TEST', '1', 'Detail');
  assert.ok(true);
});

test('logError - should format error stack', async () => {
  let capturedDetail = '';
  const capturePool = {
    query: async (sql, params) => {
      if (sql.includes('INSERT INTO log_eventos')) {
        capturedDetail = params[2];
      }
    }
  };
  const { logError: capturingLogError } = proxyquire('../src/main/services/logService', {
    '../db': { ecoPool: capturePool },
    'fs': { appendFileSync: () => {} }
  });

  const testError = new Error('Test Error');
  await capturingLogError('CONTEXT', testError, '123');
  
  assert.ok(capturedDetail.includes('Test Error'));
  assert.ok(capturedDetail.includes('at ')); // includes stack trace
});
