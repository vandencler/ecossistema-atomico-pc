const { pool } = require("../src/main/db");
const { searchClient } = require("../src/main/services/clientService");

async function test() {
  const queries = [
    "joao",
    "123",
    "test test"
  ];

  for (const q of queries) {
    console.log(`Testing query: "${q}"`);
    const res = await searchClient(q);
    if (res.error) {
      console.error(`ERROR for "${q}": ${res.error}`);
    } else {
      console.log(`Success for "${q}": ${res.rows.length} rows`);
    }
  }
  process.exit(0);
}

test();
