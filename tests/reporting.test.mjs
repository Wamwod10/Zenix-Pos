import test from "node:test";
import assert from "node:assert/strict";
import {
  saleNetRevenue, saleNetProfit, saleNetPaymentBreakdown, returnedAmountForSale,
  matchesStore, projectInventoryScope, periodRange, previousPeriodRange,
} from "../src/utils/reporting.js";
import * as reporting from "../src/utils/reporting.js";

const splitSale={
  saleTotal:100000,total:100000,paymentMethod:"split",paymentBreakdown:{cash:40000,card:60000,transfer:0},
  items:[{id:"p1",name:"Mahsulot",quantity:2,returnedQty:1,finalPrice:50000,price:50000,costPrice:30000}],
};

test("reporting uses net sale and net profit after returns",()=>{
  assert.equal(saleNetRevenue(splitSale),50000);
  assert.equal(saleNetProfit(splitSale),20000);
  assert.equal(returnedAmountForSale(splitSale),50000);
});

test("split payment mix shrinks proportionally after a partial return",()=>{
  const payment=saleNetPaymentBreakdown(splitSale);
  assert.equal(payment.cash,20000);
  assert.equal(payment.card,30000);
  assert.equal(payment.transfer,0);
  assert.equal(payment.cash+payment.card+payment.transfer,50000);
});

test("multi-store inventory scope and legacy store-name matching stay deterministic",()=>{
  const inventory=projectInventoryScope([{id:"p1",stockByStore:{s1:3,s2:7}}],"all");
  assert.equal(inventory[0].quantity,10);
  assert.equal(projectInventoryScope([{id:"p1",stockByStore:{s1:3,s2:7}}],"s2")[0].quantity,7);
  const stores=[{id:"s1",name:"Asosiy filial"},{id:"s2",name:"Chilonzor"}];
  assert.equal(matchesStore({storeId:"s2"},"s2",stores),true);
  assert.equal(matchesStore({store:"Chilonzor"},"s2",stores),true);
  assert.equal(matchesStore({store:"Asosiy filial"},"s2",stores),false);
});

test("previous reporting range is exactly the same length as current range",()=>{
  const current=periodRange("7",{timezone:"Asia/Tashkent"});
  const previous=previousPeriodRange("7",{timezone:"Asia/Tashkent"});
  const days=(from,to)=>Math.round((new Date(`${to}T12:00:00Z`)-new Date(`${from}T12:00:00Z`))/86400000)+1;
  assert.equal(days(current.from,current.to),7);
  assert.equal(days(previous.from,previous.to),7);
  const currentStart=new Date(`${current.from}T12:00:00Z`);
  const previousEnd=new Date(`${previous.to}T12:00:00Z`);
  assert.equal(Math.round((currentStart-previousEnd)/86400000),1);
});

test("seller analytics includes active cashiers and sales staff before their first sale",()=>{
  assert.equal(typeof reporting.buildSellerAnalyticsRows,"function","seller staff aggregation must be available");
  const rows=reporting.buildSellerAnalyticsRows({
    employees:[
      {id:"cashier-1",name:"Yangi kassir",role:"CASHIER",storeId:"store-1",active:true},
      {id:"sales-1",name:"Yangi sotuvchi",role:"SALES",storeId:"store-1",active:true},
      {id:"warehouse-1",name:"Omborchi",role:"WAREHOUSE",storeId:"store-1",active:true},
      {id:"inactive-1",name:"Sobiq kassir",role:"CASHIER",storeId:"store-1",active:false},
    ],
    sales:[],shiftHistory:[],period:"all",store:"store-1",stores:[{id:"store-1",name:"Asosiy filial"}],
  });
  assert.deepEqual(rows.map((row)=>row.name),["Yangi kassir","Yangi sotuvchi"]);
  assert.deepEqual(rows.map((row)=>({sales:row.sales,count:row.count,avg:row.avg})),[
    {sales:0,count:0,avg:0},{sales:0,count:0,avg:0},
  ]);
});

test('product ranking preserves negative refund-period quantity and revenue',()=>{assert.deepEqual(reporting.netItemContribution({quantity:0.4,finalPrice:100000,_financialSign:-1}),{qty:-0.4,revenue:-40000});assert.deepEqual(reporting.netItemContribution({quantity:2,returnedQty:0.5,finalPrice:100}),{qty:1.5,revenue:150})});
