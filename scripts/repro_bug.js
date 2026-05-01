const { pool } = require('../src/main/db');
const { searchClient } = require('../src/main/services/clientService');

async function test() {
  try {
    console.log('--- EXPLAIN ATTEMPT ---');
    const query = 'paulo';
    // We'll wrap the searchClient logic but with EXPLAIN
    // Since searchClient builds the SQL dynamically, we'll just use it and modify the result if we could, 
    // but better to just run a manual query that mimics searchClient.
    
    const res = await searchClient(query);
    console.log('Results:', res.rows?.length);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
test();
