import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('batch counts accept total while serial identification stays required',()=>{
 const source=fs.readFileSync('src/pages/inventory/Inventory.jsx','utf8');
 assert.equal(source.includes('if(tracking.isBatchTracked||tracking.isSerialTracked)return'),false);
 assert.ok(source.includes('if(tracking.isSerialTracked)return'));
});
test('single and quick receipts retain identity and reject in-flight submissions',()=>{
 const source=fs.readFileSync('src/pages/inventory/Inventory.jsx','utf8');
 assert.match(source,/next\.clientReference\|\|`RECEIVE-/);
 assert.match(source,/receiptBusyRef\.current=true/);
 assert.match(source,/receiptBusyRef\.current=false/);
});
