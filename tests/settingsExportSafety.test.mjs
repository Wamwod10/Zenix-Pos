import test from 'node:test';
import assert from 'node:assert/strict';
import {safeCsvCell} from '../src/utils/safeCsvCell.js';
test('CSV exports neutralize formula text without changing real numeric values',()=>{
 assert.equal(safeCsvCell('=1+1'),"\"'=1+1\"");
 assert.equal(safeCsvCell('  @SUM(1)'),"\"'  @SUM(1)\"");
 assert.equal(safeCsvCell('+998901234567'),"\"'+998901234567\"");
 assert.equal(safeCsvCell(-100),'"-100"');
 assert.equal(safeCsvCell('A "B"'),'"A ""B"""');
 assert.equal(safeCsvCell('normal'),'"normal"');
});
