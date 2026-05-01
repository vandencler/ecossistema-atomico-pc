const { ecoPool } = require('../src/main/db');

async function setupWhatsAppFeedback() {
  console.log('--- Configurando Tabela de Feedback WhatsApp ---');
  try {
    await ecoPool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_feedback (
          id SERIAL PRIMARY KEY,
          idpessoa VARCHAR(40) NOT NULL,
          phone VARCHAR(20) NOT NULL,
          event_type VARCHAR(50) NOT NULL, -- 'SENT', 'DELIVERED', 'READ', 'REPLIED', 'FAILED'
          message_sid VARCHAR(100),
          payload JSONB,
          occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabela whatsapp_feedback criada ou ja existente.');

    await ecoPool.query(`CREATE INDEX IF NOT EXISTS idx_wa_feedback_pessoa ON whatsapp_feedback(idpessoa);`);
    await ecoPool.query(`CREATE INDEX IF NOT EXISTS idx_wa_feedback_event ON whatsapp_feedback(event_type);`);
    console.log('✅ Indices criados.');

    console.log('--- Setup Concluido ---');
    process.exit(0);
  } catch (e) {
    console.error('❌ Erro no setup:', e.message);
    process.exit(1);
  }
}

setupWhatsAppFeedback();
