import test from 'node:test';
import assert from 'node:assert/strict';
import {createPosCatalog} from '../src/utils/posCatalog.js';
test('late search pages cannot replace newer results or pinned cart details',async()=>{
 const pending=[];const catalog=createPosCatalog({request:query=>new Promise(resolve=>pending.push({query,resolve})),normalize:x=>x});
 const first=catalog.search({search:'old'});const second=catalog.search({search:'new'});
 pending[1].resolve({products:[{id:'new',stockByStore:{s:2}}],categories:[],hasMore:false});await second;
 catalog.pin(['new']);pending[0].resolve({products:[{id:'old'}],categories:[],hasMore:false});await first;
 assert.deepEqual(catalog.snapshot().results.map(p=>p.id),['new']);assert.equal(catalog.snapshot().products.length,1);
 catalog.dispose();assert.equal(await catalog.search({search:'ignored'}),null);assert.equal(pending.length,2);
});
test('resolve deduplicates requests, preserves errors as unknown and reports confirmed missing IDs',async()=>{
 let calls=0,reply;const catalog=createPosCatalog({request:async()=>{calls++;return await new Promise(resolve=>reply=resolve)},normalize:x=>x});
 const a=catalog.resolve(['p','missing']),b=catalog.resolve(['missing','p']);assert.equal(calls,1);
 reply({products:[{id:'p',metadata:{packaging:[{factor:12}]},serializedUnits:[{serial:'S'}]}],missingIds:['missing']});
 const [x,y]=await Promise.all([a,b]);assert.deepEqual(x,y);assert.deepEqual(x.missingIds,['missing']);assert.equal(catalog.snapshot().products[0].serializedUnits[0].serial,'S');
 const failing=createPosCatalog({request:async()=>{throw Error('offline')},normalize:x=>x});
 await assert.rejects(failing.resolve(['p']),/offline/);assert.deepEqual(failing.snapshot().products,[]);
});
test('a newly resolved barcode survives cache pressure until the cart pins it',async()=>{
 const catalog=createPosCatalog({maxEntries:2,normalize:x=>x,request:async q=>q.ids?{products:[{id:q.ids}],missingIds:[]}:{products:[{id:'a'},{id:'b'}],categories:[],hasMore:false}});
 await catalog.search();await catalog.resolve(['scanned']);
 assert.ok(catalog.snapshot().products.some(p=>p.id==='scanned'));
 catalog.pin(['scanned']);await catalog.search();assert.ok(catalog.snapshot().products.some(p=>p.id==='scanned'));
});
test('barcode consumes one authoritative detail response without a duplicate ID request',async()=>{
 let calls=0;const catalog=createPosCatalog({normalize:x=>x,request:async q=>{calls++;assert.equal(q.barcode,'998');return {products:[{id:'p',stockByStore:{s:4}}]}}});
 assert.equal((await catalog.barcode('998')).id,'p');assert.equal(calls,1);assert.equal(catalog.snapshot().products[0].stockByStore.s,4);
});
test('only confirmed absent barcode is eligible for name-search Enter fallback',async()=>{
 const absent=createPosCatalog({normalize:x=>x,request:async()=>({products:[]})});
 await assert.rejects(absent.barcode('custom-code'),e=>e.code==='BARCODE_NOT_FOUND');
 const offline=createPosCatalog({normalize:x=>x,request:async()=>{throw Error('offline')}});
 await assert.rejects(offline.barcode('custom-code'),e=>!e.code&&e.message==='offline');
});
