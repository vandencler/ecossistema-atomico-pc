const fs = require('fs');
const path = require('path');
const { ecoPool } = require('./db');

async function initializeDatabase() {
  console.log('--- Iniciando Inicializacao do Banco de Dados Ecosystem ---');
  const schemaPath = path.join(__dirname, 'db', 'schema.sql');
  
  try {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split by semicolons for execution, but simple execution is often fine for IF NOT EXISTS
    await ecoPool.query(schema);
    
    console.log('Schema aplicado com sucesso.');
    return { ok: true };
  } catch (error) {
    console.error('Erro ao inicializar banco de dados:', error.message);
    return { ok: false, error: error.message };
  }
}

module.exports = { initializeDatabase };
