import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('platform login loads only the bounded overview instead of every tenant and payment',()=>{
  const src=readFileSync(new URL('../src/context/StoreContext.jsx',import.meta.url),'utf8');
  assert.match(src,/api\.get\("\/api\/platform\/overview"\)/);
  assert.doesNotMatch(src,/api\.get\("\/api\/platform\/bootstrap"\)/);
  assert.match(src,/setPlatformOverview\(data\.overview\|\|null\)/);
});

test('super admin lists fetch bounded pages and organization details on demand',()=>{
  const src=readFileSync(new URL('../src/pages/platformAdmin/PlatformAdmin.jsx',import.meta.url),'utf8');
  assert.match(src,/pageSize=20/);
  assert.match(src,/api\.get\(`\/api\/platform\/\$\{endpoint\}\/page\?\$\{params\}`/);
  assert.match(src,/api\.get\(`\/api\/platform\/organizations\/\$\{encodeURIComponent\(org\.id\)\}\/detail`\)/);
  assert.match(src,/Promise\.allSettled/);
  assert.match(src,/controller\.abort\(\)/);
  assert.doesNotMatch(src,/organizations\.filter\(/);
});
