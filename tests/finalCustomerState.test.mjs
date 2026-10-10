import test from 'node:test';
import assert from 'node:assert/strict';
import {appendCustomerHistory} from '../src/pages/customers/customerState.js';
test('history append preserves authoritative customer totals and removes replayed rows',()=>{
 const detail={customer:{id:'customer',balance:900},ledger:[{id:'first',amount:1}],pages:{ledger:{nextOffset:1}}};
 const next=appendCustomerHistory(detail,'ledger',{items:[{id:'first',amount:1},{id:'second',amount:2}],hasMore:false,nextOffset:null});
 assert.equal(next.customer.balance,900);assert.equal(next.ledger.length,2);assert.equal(next.pages.ledger.hasMore,false);
 assert.equal(detail.ledger.length,1);
});
