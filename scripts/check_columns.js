const { pool } = require('../src/main/db');

async function checkColumns() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'wshop' AND table_name = 'pessoas'
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e.message);
  } finally {
    process.exit(0);
  }
}

checkColumns();
