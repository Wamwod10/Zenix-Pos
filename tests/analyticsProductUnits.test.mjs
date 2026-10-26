import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

test("Analytics ranks historical units separately for the same product",async()=>{
  const vite=await createServer({server:{middlewareMode:true},appType:"custom",logLevel:"silent"});
  try{
    const {buildAnalyticsProductMap}=await vite.ssrLoadModule("/src/pages/analytics/Analytics.jsx");
    const map=buildAnalyticsProductMap([{items:[
      {productId:"p1",name:"Same",unit:"kg",quantity:2,price:10},
      {productId:"p1",name:"Same",unit:"dona",quantity:3,price:10},
      {productId:"p1",name:"Renamed",unit:"kg",quantity:5,price:10},
      {productId:"p2",name:"Same",unit:"kg",quantity:4,price:10},
    ]}]);
    assert.deepEqual(Object.values(map).map(({unit,qty,revenue})=>({unit,qty,revenue})),[
      {unit:"kg",qty:7,revenue:70},{unit:"dona",qty:3,revenue:30},{unit:"kg",qty:4,revenue:40},
    ]);
    assert.equal(map[JSON.stringify(["p1","kg"])].qty,7);
    assert.equal(map[JSON.stringify(["p1","dona"])].qty,3);
  }finally{await vite.close();}
});
