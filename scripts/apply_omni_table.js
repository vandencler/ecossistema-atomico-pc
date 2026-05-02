const { ecoPool } = require('../src/main/db');

async function run() {
  try {
    console.log('Applying omnichannel table surgical update...');
    
    await ecoPool.query(`
      CREATE TABLE IF NOT EXISTS omnichannel_mensagens (
          id SERIAL PRIMARY KEY,
          idpessoa VARCHAR(40) NOT NULL,
          direcao VARCHAR(10) NOT NULL, -- INBOUND, OUTBOUND
          canal VARCHAR(20) DEFAULT 'WHATSAPP',
          conteudo TEXT,
          status VARCHAR(20), -- SENT, DELIVERED, READ, RECEIVED, ERROR
          external_id VARCHAR(100),
          criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await ecoPool.query('CREATE INDEX IF NOT EXISTS idx_omni_mensagens_pessoa ON omnichannel_mensagens(idpessoa);');
    await ecoPool.query('CREATE INDEX IF NOT EXISTS idx_omni_mensagens_criado ON omnichannel_mensagens(criado_em);');

    console.log('✅ omnichannel_mensagens table verified/created.');
    
    const res = await ecoPool.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'omnichannel_mensagens'");
    console.log('Table exists check:', res.rows.length > 0);

  } catch (e) {
    console.error('Error applying surgical update:', e.message);
  } finally {
    process.exit(0);
  }
}

run();
