import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {createServer} from 'vite';
test('today sale renders original/refund/net, time, cashier, units and expandable products',async()=>{
 const server=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
 try{
  const {TodaySaleCard}=await server.ssrLoadModule('/src/pages/sales/TodaySales.jsx');
  const html=renderToStaticMarkup(React.createElement(TodaySaleCard,{sale:{saleNumber:'S-17',date:'09.10.2026',time:'14:15',sellerName:'Cashier',paymentMethod:'credit',originalTotal:100,returnedTotal:25,netTotal:75,returnStatus:'partial_returned',items:Array.from({length:10},(_,i)=>({id:i,name:`Apple ${i}`,quantity:2,unit:'kg'}))}}));
  for(const text of ['S-17','14:15','Cashier','Original','Qaytarilgan','Sof','Nasiya','kg','Qisman','<details>','Yana 7'])assert.ok(html.includes(text),text);
 }finally{await server.close()}
});
