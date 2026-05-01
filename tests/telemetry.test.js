const test = require('node:test');
const assert = require('node:assert');
const proxyquire = require('proxyquire');

test('TelemetryService - trackEvent and bulk flush', async () => {
  let capturedSql = '';
  let capturedParams = [];
  
  const mockEcoPool = {
    query: async (sql, params) => {
      capturedSql = sql;
      capturedParams = params;
      return { rowCount: 1 };
    }
  };

  const mockLocalDb = {
    buffer: [],
    prepare: function(sql) {
      return {
        run: (...args) => {
          if (sql.includes('INSERT INTO telemetry_buffer')) {
            this.buffer.push({ event_name: args[0], user_id: args[1], payload: args[2], occurred_at: args[3], id: this.buffer.length + 1 });
          } else if (sql.includes('DELETE FROM telemetry_buffer')) {
            const idsToDelete = args[0];
            this.buffer = this.buffer.filter(b => !idsToDelete.includes(b.id));
          }
        },
        all: () => {
          if (sql.includes('SELECT * FROM telemetry_buffer')) return this.buffer.slice(0, 100);
          return [];
        }
      };
    }
  };

  const telemetryService = proxyquire('../src/main/services/telemetryService', {
    '../db': { ecoPool: mockEcoPool },
    '../localDb': { getLocalDb: () => mockLocalDb }
  });

  // 1. Track an event
  await telemetryService.trackEvent('test_event', 'user1', { foo: 'bar' });
  
  // Wait for setImmediate
  await new Promise(resolve => setImmediate(resolve));
  
  // Verify multi-row insert (even for 1 row, it uses the new syntax)
  assert.ok(capturedSql.includes('INSERT INTO telemetry_events'));
  assert.ok(capturedSql.includes('VALUES ($1, $2, $3, $4, $5)'));
  assert.strictEqual(capturedParams[0], 'test_event');
  assert.strictEqual(capturedParams[1], 'user1');
  assert.deepStrictEqual(capturedParams[2], { foo: 'bar' });
});
