const fs = require('fs');
const path = require('path');
const { ecoPool } = require('./db');

async function initializeDatabase() {
  console.log('--- Iniciando Inicializacao do Banco de Dados Ecosystem ---');
  const schemaPath = path.join(__dirname, 'db', 'schema.sql');
  
  try {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Simple execution is fine for IF NOT EXISTS, we will just log if it fails
    try {
      await ecoPool.query(schema);
      console.log('Schema aplicado com sucesso.');
    } catch (e) {
      console.warn(`[DB INIT] Aviso ao executar schema em bloco: ${e.message}`);
    }
    
    return { ok: true };
  } catch (error) {
    console.error('Erro ao inicializar banco de dados:', error.message);
    return { ok: false, error: error.message };
  }
}

module.exports = { initializeDatabase };
