const test = require('node:test');
const assert = require('node:assert');
const proxyquire = require('proxyquire');

async function testNps() {
  const rand = Math.floor(Math.random() * 10000);
  const testUserId = 'rep_' + rand;
  const testIdPessoa = 'C_' + rand;

  console.log(`--- Iniciando Teste do NPS Service (${testUserId}) ---`);

  const mockPool = {
    query: async (sql, params) => {
      if (sql.includes('stvendedor = true')) {
        return {
          rows: [{ idpessoa: testIdPessoa, nmpessoa: 'Vendedor Teste', nrtelefone: '5521988887777', campostelwhatsapp: null }]
        };
      }
      if (sql.includes('SELECT campostelwhatsapp, nrtelefone')) {
        return {
          rows: [{ campostelwhatsapp: '5521988887777', nrtelefone: null }]
        };
      }
      return { rows: [] };
    }
  };

  const mockEcoPool = {
    query: async (sql, params) => {
      const { ecoPool: realEco } = require('../src/main/db');
      return realEco.query(sql, params);
    }
  };

  const mockOmni = {
    sendWhatsAppMessage: async (id, msg) => {
      console.log(`[MOCK OMNI] Sent to ${id}: ${msg}`);
      return { ok: true, phone: '5521988887777' };
    }
  };

  const npsService = proxyquire('../src/main/services/npsService', {
    '../db': { pool: mockPool, ecoPool: mockEcoPool },
    './omnichannelService': mockOmni
  });

  const { ecoPool } = require('../src/main/db');

  try {
    // 0. Setup config
    await ecoPool.query(`
      INSERT INTO config_sistema (chave, valor, descricao)
      VALUES 
        ('nps_survey_enabled', 'true', 'test'),
        ('nps_survey_delay_days', '0', 'test'),
        ('omnichannel_whatsapp_enabled', 'true', 'test')
      ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;
    `);

    // 1. Setup telemetry
    await ecoPool.query(`DELETE FROM telemetry_events WHERE user_id = $1`, [testUserId]);
    await ecoPool.query(`
      INSERT INTO telemetry_events (event_name, user_id, occurred_at)
      VALUES ('login', $1, NOW() - INTERVAL '1 hour')
    `, [testUserId]);

    // 2. Run Cycle
    await npsService.runCycle();

    // 3. Verify
    const sent = await ecoPool.query("SELECT * FROM nps_scores WHERE user_id = $1", [testUserId]);
    assert.ok(sent.rows.length > 0, 'Should have sent NPS');

    // 4. Inbound
    await npsService.processResponse(testIdPessoa, 'Nota 9');

    // 5. Final Verify
    const res = await ecoPool.query("SELECT COUNT(*) as count FROM nps_scores WHERE idpessoa = $1 AND score = 9", [testIdPessoa]);
    assert.strictEqual(parseInt(res.rows[0].count), 1);

    console.log('✅ NPS Verification Success!');

  } catch (e) {
    console.error('❌ NPS Verification Failed:', e.message);
    process.exit(1);
  } finally {
    await ecoPool.query("DELETE FROM telemetry_events WHERE user_id = $1", [testUserId]);
    await ecoPool.query("DELETE FROM nps_scores WHERE user_id = $1", [testUserId]);
    process.exit(0);
  }
}

testNps();
