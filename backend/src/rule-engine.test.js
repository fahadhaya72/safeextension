import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRules } from './rule-engine.js';

test('ordinary domains are not warned for repeated normal letters', () => {
  const result = evaluateRules('https://example.com', 'example.com');

  assert.equal(result.shouldBlock, false);
  assert.equal(result.shouldWarn, false);
  assert.deepEqual(result.reasons, []);
});

test('brand names embedded in subdomains are detected without throwing', () => {
  const hostname = 'paypal.secure-login.example';
  const result = evaluateRules(`https://${hostname}`, hostname);

  assert.equal(result.shouldBlock, true);
  assert.ok(result.reasons.some(reason => reason.includes('paypal')));
});

test('known character substitutions remain detectable', () => {
  const hostname = 'goog1e.com';
  const result = evaluateRules(`https://${hostname}`, hostname);

  assert.equal(result.shouldBlock, true);
  assert.ok(result.reasons.some(reason => reason.includes('Character substitution')));
});