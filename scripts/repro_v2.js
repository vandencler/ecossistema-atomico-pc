const { pool } = require('../src/main/db');
const { searchClient } = require('../src/main/services/clientService');

async function test() {
  // We want to force hasTrgm = false. 
  // Since searchClient calls getIndexMap which calls checkHealth, 
  // we might need to mock it or find a way.
  // However, I can just see if I can trigger it with a normal search 
  // if my current environment doesn't have Trigram.
  
  const q = 'test';
  console.log(`Testing query: "${q}"`);
  const res = await searchClient(q);
  if (res.error) {
    console.error(`❌ Error:`, res.error);
  } else {
    console.log(`✅ Success: ${res.rows.length} rows`);
  }
  process.exit(0);
}

test();
