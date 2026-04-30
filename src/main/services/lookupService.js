const { pool } = require('../db');

async function getPriceTables() {
  try {
    const result = await pool.query('SELECT idtabela, dstabela FROM wshop.tabelaprecos ORDER BY dstabela');
    return { rows: result.rows };
  } catch (e) {
    return { error: e.message };
  }
}

async function getConvenios() {
  try {
    const result = await pool.query(
      'SELECT idpessoa, nmpessoa FROM wshop.pessoas WHERE stconvenio = true ORDER BY nmpessoa'
    );
    return { rows: result.rows };
  } catch (e) {
    return { error: e.message };
  }
}

module.exports = {
  getPriceTables,
  getConvenios
};
