const test = require('node:test');
const assert = require('node:assert');
const { searchClient } = require('../src/main/services/clientService');

test('EAV-117 Stress Test: Search Parameter Type Stability', async () => {
  console.log('--- Starting Search Stress Test ---');
  let errors = 0;
  
  // A mix of challenging queries: pure numbers, alphanumeric, special chars, short strings
  const queries = [
    'joao', '12345', '123.456.789-00', 'joão da silva', 'MARIA', 'J', 'ab c d e', 
    '0100', '(11) 98888-7777', 'empresa ltda', 'são paulo', 'teste com " aspas',
    'teste com \' aspas', 't', '  espaços  ', '99', 'a1', '1a'
  ];

  // We will run this 100 times to simulate high concurrency and varying inputs
  const iterations = 100;
  
  for (let i = 0; i < iterations; i++) {
    const q = queries[i % queries.length] + (i > queries.length ? ` ${i}` : '');
    try {
      const res = await searchClient(q);
      if (res.error) {
        console.error(`Query failed: "${q}" -> ${res.error}`);
        errors++;
      }
    } catch (e) {
      console.error(`Exception on query: "${q}" -> ${e.message}`);
      errors++;
    }
  }

  console.log(`Stress test completed. Total errors: ${errors}/${iterations}`);
  assert.strictEqual(errors, 0, 'There should be zero search errors during the stress test.');
});