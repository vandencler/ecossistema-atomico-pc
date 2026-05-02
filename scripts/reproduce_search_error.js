const { searchClient } = require('../src/main/services/clientService');

async function testSearch() {
  console.log('Testing searchClient...');
  try {
    const result = await searchClient('teste');
    if (result.error) {
      console.error('Search Result Error:', result.error);
    } else {
      console.log('Search Result Success, rows:', result.rows.length);
    }
  } catch (e) {
    console.error('Caught Error:', e);
  }
  process.exit(0);
}

testSearch();
