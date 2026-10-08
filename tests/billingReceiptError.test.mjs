import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('reused billing receipts have a specific actionable error without modifying styles', () => {
  const api = readFileSync(new URL('../src/services/apiClient.js', import.meta.url), 'utf8');
  assert.match(api, /BILLING_RECEIPT_ALREADY_USED\s*:\s*"[^"]*Yangi chek yuklang/);
  assert.match(api, /const friendlyError=\(error,status\)=>FRIENDLY_ERRORS\[error\?\.code\]/);
});
