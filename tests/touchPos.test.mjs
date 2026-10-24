import test from 'node:test';
import assert from 'node:assert/strict';
import {touchKey,priceDiscount} from '../src/pages/posPro/touchInput.js';
test('touch keypad accepts decimal edits, 00 and backspace without duplicate decimal points',()=>{
 assert.equal(touchKey('','00'),'0');assert.equal(touchKey('','.'),'0.');
 assert.equal(touchKey('1.2','.'),'1.2');assert.equal(touchKey('12','00'),'1200');
 assert.equal(touchKey('12','backspace'),'1');assert.equal(touchKey('12','clear'),'');
 assert.equal(touchKey('0','5'),'5');assert.equal(touchKey('123456789012345','7'),'123456789012345');
});
test('target unit price uses existing discounts and never permits price increases',()=>{
 assert.equal(priceDiscount(100,90,0),10);
 assert.equal(priceDiscount(100,81,10),10);
 assert.equal(priceDiscount(100,0,0),100);
 for(const price of [-1,101,NaN,Infinity])assert.throws(()=>priceDiscount(100,price,0));
 assert.throws(()=>priceDiscount(0,1,0));
 const target=9999999.99,discount=priceDiscount(10000000,target);
 assert.equal(Math.round(10000000*(1-discount/100)*100),Math.round(target*100));
});
