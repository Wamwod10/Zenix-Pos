import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_WORKSPACE_SETTINGS} from '../src/config/uiDefaults.js';
import {readFileSync} from 'node:fs';
test('loyalty is disabled by default and uses shared global settings',()=>{
 assert.deepEqual(DEFAULT_WORKSPACE_SETTINGS.loyalty,{enabled:false,spendPerPoint:10000});
 const s=readFileSync(new URL('../src/pages/settings/Settings.jsx',import.meta.url),'utf8');
 assert.match(s,/updateSection\("loyalty","enabled",v\)/);
 assert.match(s,/updateSection\("loyalty","spendPerPoint",Number\(e.target.value\)\)/);
 assert.doesNotMatch(s,/STORE_SCOPED_TABS=new Set\([^\n]*Funksiyalar/);
});
