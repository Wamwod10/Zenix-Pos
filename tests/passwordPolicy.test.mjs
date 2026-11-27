import test from 'node:test';
import assert from 'node:assert/strict';
import {newPasswordError} from '../src/utils/passwordPolicy.js';
test('new password byte length supports Unicode but prevents bcrypt truncation',()=>{
 assert.equal(newPasswordError('a'.repeat(72)),'');
 assert.equal(newPasswordError('ў'.repeat(36)),'');
 assert.match(newPasswordError('ў'.repeat(37)),/72 bayt/);
 assert.match(newPasswordError('a'.repeat(73)),/72 bayt/);
 assert.match(newPasswordError('short'),/8 ta/);
 assert.match(newPasswordError('12345678',12),/12 ta/);
 assert.equal(newPasswordError('123456789012',12),'');
});
