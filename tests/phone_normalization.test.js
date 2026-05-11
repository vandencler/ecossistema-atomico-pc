const assert = require('node:assert');
const { normalizeBrazilianPhone } = require('../src/main/utils');

function testNormalization() {
  console.log('--- Testing 9th Digit Normalization Logic ---');

  const tests = [
    { input: '1188888888', expected: '11988888888', desc: 'Adds 9 for mobile' },
    { input: '1133333333', expected: '1133333333', desc: 'Keeps fixed line (starting with 3)' },
    { input: '11 98888-8888', expected: '11988888888', desc: 'Cleans formatting' },
    { input: '551188888888', expected: '11988888888', desc: 'Handles country code 55 and adds 9' },
    { input: '01188888888', expected: '11988888888', desc: 'Removes leading zero and adds 9' },
    { input: '11999999999', expected: '11999999999', desc: 'Keeps already correct 11 digits' },
    { input: '1122222222', expected: '1122222222', desc: 'Keeps fixed line (starting with 2)' },
    { input: '1166666666', expected: '11966666666', desc: 'Adds 9 for mobile starting with 6' },
  ];

  let passed = 0;
  for (const t of tests) {
    const result = normalizeBrazilianPhone(t.input);
    try {
      assert.strictEqual(result, t.expected);
      console.log(`[PASS] ${t.desc}: ${t.input} -> ${result}`);
      passed++;
    } catch (e) {
      console.error(`[FAIL] ${t.desc}: Expected ${t.expected}, got ${result}`);
    }
  }

  console.log(`\nTests passed: ${passed}/${tests.length}`);
  if (passed === tests.length) {
    console.log('✅ Normalization logic is robust.');
  } else {
    process.exit(1);
  }
}

testNormalization();
