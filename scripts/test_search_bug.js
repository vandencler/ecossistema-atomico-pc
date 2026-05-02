
const cwd = process.cwd();
if (!cwd.toLowerCase().includes("-pc")) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error("This script MUST be executed from D:\projetos\ecossistema-atomico-pc");
    process.exit(1);
}

const { searchClient } = require('../src/main/services/clientService');

async function test() {
  console.log('Testing searchClient...');
  try {
    const result = await searchClient('francisco');
    if (result.error) {
      console.error('Search Error:', result.error);
    } else {
      console.log('Search Success! Rows:', result.rows.length);
      if (result.rows.length > 0) {
        console.log('First result:', result.rows[0].nmpessoa);
      }
    }
  } catch (e) {
    console.error('Fatal Error:', e.message);
  } finally {
    process.exit(0);
  }
}

test();
