const { pool } = require('../src/main/db');

async function checkIndexDefinitions() {
  const sql = `
    SELECT
        t.relname as table_name,
        i.relname as index_name,
        pg_get_indexdef(indexrelid) as index_definition
    FROM
        pg_index x
        JOIN pg_class c ON c.oid = x.indrelid
        JOIN pg_class i ON i.oid = x.indexrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_am am ON i.relam = am.oid
        LEFT JOIN pg_class t ON c.oid = t.oid
    WHERE
        n.nspname = 'wshop'
        AND t.relname = 'pessoas'
        AND i.relname LIKE '%trgm%';
  `;

  try {
    const res = await pool.query(sql);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e.message);
  } finally {
    process.exit(0);
  }
}

checkIndexDefinitions();