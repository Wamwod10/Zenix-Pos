import test from 'node:test';
import assert from 'node:assert/strict';
const {mapBootstrapInventory}=await import('../src/utils/bootstrapInventory.js').catch(()=>({}));
test('inventory normalization cooperates without publishing a partial snapshot or changing objects',async()=>{
 assert.equal(typeof mapBootstrapInventory,'function');
 const legacy=[{id:'a',stock:{x:'1.250'}},{id:'b',stock:null}];
 let yields=0;
 const options={chunkSize:1,yieldControl:async()=>{yields++},isCurrent:()=>true};
 const normalize=row=>({...row,ready:true});
 assert.deepEqual(await mapBootstrapInventory(legacy,normalize,options),legacy.map(normalize));
 assert.equal(yields,1);
});
test('stale hydration stops after yielding and malformed snapshots cannot mark workspace ready',async()=>{
 assert.equal(typeof mapBootstrapInventory,'function');let current=true,mapped=0;
 const result=await mapBootstrapInventory([{id:1},{id:2}],x=>{mapped++;return x},{chunkSize:1,isCurrent:()=>current,yieldControl:async()=>{current=false}});
 assert.equal(result,null);assert.equal(mapped,1);
 await assert.rejects(()=>mapBootstrapInventory({rows:[[1,2]]},x=>x),/inventory/i);
 await assert.rejects(()=>mapBootstrapInventory([],x=>x,{chunkSize:0}),/chunk size/i);
});
