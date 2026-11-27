import test from 'node:test';import assert from 'node:assert/strict';
import {promotionItems,applyPromotionQuotes,promotionSignature} from '../src/pages/posPro/promotionQuotes.js';
const cart=[{id:'p',unit:'dona',cartQty:3,sellPrice:100},{id:'kg',unit:'kg',cartQty:2,sellPrice:100}];
const q={productId:'p',ruleId:'a',gross:300,discount:100,net:200};
test('eligible lines, exact quote amount and stale/malformed response rejection',()=>{
 assert.deepEqual(promotionItems(cart,0),[{productId:'p',quantity:3}]);assert.deepEqual(promotionItems(cart,5),[]);
 const x=applyPromotionQuotes(cart,0,[q]);assert.equal(x[0].promotionNet,200);assert.equal(x[1],cart[1]);assert.equal(promotionSignature(x),'[["p","a",200]]');
 for(const quotes of [[{...q,net:199}],[q,q],[{...q,productId:'kg'}],[{...q,gross:301}]])assert.throws(()=>applyPromotionQuotes(cart,0,quotes));
 assert.throws(()=>applyPromotionQuotes(cart,5,[q]));
});
