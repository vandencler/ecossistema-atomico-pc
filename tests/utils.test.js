const test = require('node:test');
const assert = require('node:assert');
const utils = require('../src/main/utils');

test('normalizeId', () => {
  assert.strictEqual(utils.normalizeId('  123  '), '123');
  assert.throws(() => utils.normalizeId(''), /id invalido/);
  assert.throws(() => utils.normalizeId('a'.repeat(41)), /id invalido/);
});

test('normalizeDateInput', () => {
  assert.strictEqual(utils.normalizeDateInput('2026-04-30'), '2026-04-30');
  assert.strictEqual(utils.normalizeDateInput('30/04/2026'), '2026-04-30');
  assert.strictEqual(utils.normalizeDateInput('30042026'), '2026-04-30');
  assert.throws(() => utils.normalizeDateInput('invalid'), /Data invalida/);
});

test('normalizeFieldValue - phone', () => {
  const config = { type: 'phone', max: 30, label: 'Telefone' };
  assert.strictEqual(utils.normalizeFieldValue(config, '(11) 98765-4321'), '11987654321');
});

test('normalizeFieldValue - email', () => {
  const config = { type: 'email', max: 180, label: 'E-mail' };
  assert.strictEqual(utils.normalizeFieldValue(config, ' test@example.com '), 'test@example.com');
  assert.throws(() => utils.normalizeFieldValue(config, 'invalid-email'), /E-mail invalido/);
});

test('normalizeFieldValue - uf', () => {
  const config = { type: 'uf', max: 2, label: 'UF' };
  assert.strictEqual(utils.normalizeFieldValue(config, ' rj '), 'RJ');
  assert.throws(() => utils.normalizeFieldValue(config, 'RIO'), /UF excede 2 caracteres/);
});

test('normalizeFieldValue - cep', () => {
  const config = { type: 'cep', max: 12, label: 'CEP' };
  assert.strictEqual(utils.normalizeFieldValue(config, ' 22.000-000 '), '22000000');
});

test('normalizeCorrectionPayload', () => {
  const payload = {
    idpessoa: '123',
    changes: [
      { campo: 'nmpessoa', valorNovo: ' João Silva ', valorOriginal: 'Joao Silva' }
    ]
  };
  const normalized = utils.normalizeCorrectionPayload(payload);
  assert.strictEqual(normalized.idpessoa, '123');
  assert.strictEqual(normalized.changes[0].valorNovo, 'João Silva');
});
