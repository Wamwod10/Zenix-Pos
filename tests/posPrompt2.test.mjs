import test from 'node:test';import assert from 'node:assert/strict';
import {getSaleNetTotal,clampReturnQty} from '../src/utils/returns.js';
import {savePosDraft,readPosDraft} from '../src/utils/posDraft.js';
import {lineAmount,sumMoney} from '../src/utils/posMoney.js';
test('database refund total remains authoritative even when return detail window is truncated',()=>{
 assert.equal(getSaleNetTotal({total:100,returnedTotal:25,items:[{quantity:1,finalPrice:100,returnedQty:0}]}),75);
});
test('weighted return preserves 0.5 kg and rejects nonpositive quantities',()=>{
 assert.equal(clampReturnQty({quantity:2.5},0.5),0.5);
 assert.equal(clampReturnQty({quantity:2.5},0),0);
});
test('discounted basket rounds each line before summing, matching checkout server',()=>{
 assert.equal(sumMoney(Array(4).fill(lineAmount(1,1*(1-66.6/100)))),1.32);
});
test('draft persists checkout identity and payment intent but never arbitrary credentials',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 savePosDraft(storage,'draft',{cart:[{id:'a',cartQty:1}],checkoutReference:'same-sale',customerId:'customer',splitCard:'50',token:'secret',cardNumber:'123456'});
 const draft=readPosDraft(storage,'draft');assert.equal(draft.checkoutReference,'same-sale');assert.equal(draft.splitCard,'50');
 assert.equal(draft.token,undefined);assert.equal(draft.cardNumber,undefined);
});
