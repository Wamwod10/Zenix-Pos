import test from "node:test";
import assert from "node:assert/strict";
import { allocateTrackedStock, restoreTrackedStock } from "../src/utils/stockTracking.js";

test("serialized stock is allocated on sale and restored on partial return", () => {
  const product={id:"p1",name:"Telefon",quantity:3,serializedUnits:[
    {id:"u1",serial:"IMEI-1",storeId:"s1",status:"IN_STOCK"},
    {id:"u2",serial:"IMEI-2",storeId:"s1",status:"IN_STOCK"},
    {id:"u3",serial:"IMEI-3",storeId:"s1",status:"IN_STOCK"},
  ]};
  const sale=allocateTrackedStock(product,"s1",2,{saleId:"SALE-1",soldAt:"2026-09-24T10:00:00Z"});
  assert.equal(sale.success,true);
  assert.equal(sale.product.quantity,1);
  assert.deepEqual(sale.tracking.serials.map((item)=>item.serial),["IMEI-1","IMEI-2"]);
  assert.equal(sale.product.serializedUnits.filter((item)=>item.status==="SOLD").length,2);

  const returned=restoreTrackedStock(sale.product,"s1",1,sale.tracking,0,{saleId:"SALE-1",returnId:"RET-1"});
  assert.equal(returned.success,true);
  assert.equal(returned.product.quantity,2);
  assert.equal(returned.product.serializedUnits.find((item)=>item.id==="u1").status,"IN_STOCK");
  assert.equal(returned.product.serializedUnits.find((item)=>item.id==="u2").status,"SOLD");

  const second=restoreTrackedStock(returned.product,"s1",1,sale.tracking,1,{saleId:"SALE-1",returnId:"RET-2"});
  assert.equal(second.product.serializedUnits.find((item)=>item.id==="u2").status,"IN_STOCK");
});

test("batch stock uses FEFO and restores the exact returned slice", () => {
  const product={id:"p2",name:"Sut",quantity:10,stockBatches:[
    {id:"b1",storeId:"s1",quantity:4,remaining:4,expiryDate:"2026-10-01",receivedAt:"2026-09-01"},
    {id:"b2",storeId:"s1",quantity:6,remaining:6,expiryDate:"2026-10-15",receivedAt:"2026-09-02"},
  ]};
  const sale=allocateTrackedStock(product,"s1",6,{saleId:"SALE-2"});
  assert.equal(sale.success,true);
  assert.deepEqual(sale.tracking.batches.map((item)=>[item.batchId,item.quantity]),[["b1",4],["b2",2]]);
  assert.equal(sale.product.stockBatches.find((item)=>item.id==="b1").remaining,0);
  assert.equal(sale.product.stockBatches.find((item)=>item.id==="b2").remaining,4);

  const returned=restoreTrackedStock(sale.product,"s1",3,sale.tracking,2,{saleId:"SALE-2"});
  assert.equal(returned.product.quantity,7);
  assert.equal(returned.product.stockBatches.find((item)=>item.id==="b1").remaining,2);
  assert.equal(returned.product.stockBatches.find((item)=>item.id==="b2").remaining,5);
});

test("legacy untracked stock can coexist with tracked units", () => {
  const product={id:"p3",name:"Aralash",quantity:5,serializedUnits:[
    {id:"u1",serial:"S1",storeId:"s1",status:"IN_STOCK"},
    {id:"u2",serial:"S2",storeId:"s1",status:"IN_STOCK"},
  ]};
  const sale=allocateTrackedStock(product,"s1",4,{saleId:"SALE-3"});
  assert.equal(sale.success,true);
  assert.equal(sale.product.quantity,1);
  assert.equal(sale.tracking.serials.length,2);
  assert.equal(sale.tracking.untrackedQty,2);
});
