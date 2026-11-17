import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(file)=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('customer modal CSS stays in the lazy platform route and out of global bootstrap',()=>{
  assert.match(read('src/App.jsx'), /const PlatformAdmin=lazy\(\(\)=>import\("\.\/pages\/platformAdmin\/PlatformAdmin"\)\)/);
  assert.match(read('src/pages/platformAdmin/PlatformAdmin.jsx'), /import "\.\/platformCustomerModal\.scss";/);
  assert.doesNotMatch(read('src/styles/saas.scss'), /\.platform-customer-modal/);
  const modal=read('src/pages/platformAdmin/platformCustomerModal.scss');
  assert.match(modal, /\.platform-customer-modal\s*\{/);
  assert.match(modal, /\.platform-customer-modal \.platform-customer-license-actions/);
});
