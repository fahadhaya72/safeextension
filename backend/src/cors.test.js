import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedOrigin } from './cors.js';

const extensionId = 'abcdefghijklmnopabcdefghijklmnop';

test('allows the configured Chrome extension ID', () => {
  assert.equal(isAllowedOrigin(`chrome-extension://${extensionId}`, {
    allowedOrigin: 'https://safeextension.vercel.app',
    extensionId
  }), true);
});

test('rejects a different Chrome extension ID', () => {
  assert.equal(isAllowedOrigin('chrome-extension://ponmlkjihgfedcbaponmlkjihgfedcba', {
    allowedOrigin: 'https://safeextension.vercel.app',
    extensionId
  }), false);
});

test('does not allow the placeholder extension ID', () => {
  assert.equal(isAllowedOrigin('chrome-extension://your_extension_id', {
    allowedOrigin: 'https://safeextension.vercel.app',
    extensionId: 'your_extension_id'
  }), false);
});

test('continues to allow configured web and local origins', () => {
  assert.equal(isAllowedOrigin('http://localhost:3000', { allowedOrigin: 'https://safeextension.vercel.app' }), true);
  assert.equal(isAllowedOrigin('https://safeextension.vercel.app', { allowedOrigin: 'https://safeextension.vercel.app' }), true);
});