const { ecoPool } = require('../db');
const fs = require('fs');
const path = require('path');

function _logToFile(tipo, detalhe) {
  const nodeEnv = (process.env.NODE_ENV || '').trim();
  if (nodeEnv === 'test' || process.env.ELECTRON_RUN_AS_NODE === '1') return;
  try {
    const logPath = path.join(process.cwd(), 'system.log');
    const line = `[${new Date().toISOString()}] [${tipo}] ${detalhe}\n`;
    fs.appendFileSync(logPath, line, 'utf8');
  } catch (e) {
    console.error('Falha ao escrever log em arquivo:', e.message);
  }
}

/**
 * Centralized logging for the Ecosystem.
 */
async function logEvent(tipo, idpessoa, detalhe, usuario = 'sistema') {
  // Always log to console and file for reliability
  console.log(`[LOG] ${tipo} | ${idpessoa} | ${detalhe}`);
  _logToFile(tipo, `${idpessoa} | ${detalhe}`);

  try {
    await ecoPool.query(`
      INSERT INTO log_eventos (tipo, idpessoa, detalhe, usuario, criado_em)
      VALUES ($1, $2, $3, $4, NOW())
    `, [tipo, idpessoa, detalhe, usuario]);
  } catch (e) {
    console.error('[CRITICAL] Falha ao registrar log no banco:', e.message, { tipo, idpessoa, detalhe, usuario });
  }
}


/**
 * Specialized log for errors.
 */
async function logError(contexto, error, idpessoa = '0', usuario = 'sistema') {
  const detalhe = error instanceof Error ? error.stack : String(error);
  await logEvent(`${contexto}_ERROR`, idpessoa, detalhe, usuario);
}

module.exports = {
  logEvent,
  logError
};
