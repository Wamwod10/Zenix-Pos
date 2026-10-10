import test from 'node:test';
import assert from 'node:assert/strict';
import {formatUzPhone,normalizedUzPhone} from '../src/utils/phone.js';

test('a local nine-digit phone beginning 998 keeps all its digits',()=>{
  assert.equal(normalizedUzPhone('998123456'),'998998123456');
  assert.equal(formatUzPhone('998123456'),'+998 99 812 34 56');
  assert.equal(normalizedUzPhone('+998 99 812 34 56'),'998998123456');
  assert.equal(normalizedUzPhone('998901234567'),'998901234567');
  assert.equal(formatUzPhone('+998 '),'+998 ');
});
