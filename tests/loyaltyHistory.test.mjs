import test from 'node:test';
import assert from 'node:assert/strict';
import {appendCustomerHistory} from '../src/pages/customers/customerState.js';
test('loyalty pages initialize lazily and deduplicate entries',()=>{
 const first={items:[{id:'a',points:3}],hasMore:true,nextOffset:50};
 let d=appendCustomerHistory({customer:{id:'x',loyaltyPoints:3},pages:{}},'loyalty',first);
 assert.deepEqual(d.loyalty,first.items);assert.equal(d.pages.loyalty.nextOffset,50);
 d=appendCustomerHistory(d,'loyalty',{items:[{id:'a',points:3},{id:'b',points:-1}],hasMore:false});
 assert.deepEqual(d.loyalty.map(x=>x.id),['a','b']);assert.equal(d.pages.loyalty.hasMore,false);
});
