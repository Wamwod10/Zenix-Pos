import test from 'node:test';import assert from 'node:assert/strict';
import {posDraftKey,readPosDraft,savePosDraft,clearPosDraft} from '../src/utils/posDraft.js';
import {reconcilePersistedCart as reconcile} from '../src/utils/posCartReconciliation.js';
import {allocateTrackedStock} from '../src/utils/stockTracking.js';
const product = {id:'p1',name:'Current phone',sellPrice:120,taxRate:12,serialTracking:true,batchTracking:true,stockByStore:{s1:5,s2:50},serializedUnits:[],stockBatches:[]};
const savedLine = {id:'p1',name:'Old phone',sellPrice:100,taxRate:0,serialTracking:false,cartQty:3,discountPercent:10,quantity:999};

test('restore reports price increases and decreases and rebuilds catalog fields',()=>{
 for (const [price,type] of [[120,'price_increased'],[80,'price_decreased']]) {
  const result=reconcile({lines:[savedLine],products:[{...product,sellPrice:price}],storeId:'s1'});
  assert.equal(result.lines[0].sellPrice,price);
  assert.equal(result.lines[0].name,'Current phone');
  assert.equal(result.lines[0].taxRate,12);
  assert.equal(result.lines[0].serialTracking,true);
  assert.equal(result.lines[0].quantity,5);
  assert.ok(result.changes.some(change=>change.type===type&&change.previousPrice===100&&change.currentPrice===price));
 }
});
test('restore removes archived and missing products while retaining unaffected lines',()=>{
 const result=reconcile({lines:[savedLine,{id:'deleted',cartQty:1},{id:'archived',cartQty:1}],products:[product,{id:'archived',archived:true}],storeId:'s1'});
 assert.deepEqual(result.lines.map(line=>line.id),['p1']);
 assert.deepEqual(result.changes.filter(change=>change.type==='product_removed').map(change=>[change.productId,change.reason]),[['deleted','missing'],['archived','archived']]);
});
test('restore flags current-store stock shortage without reducing cashier quantity',()=>{
 const result=reconcile({lines:[savedLine],products:[{...product,stockByStore:{s1:2,s2:50}}],storeId:'s1'});
 assert.equal(result.hasBlockingStockIssue,true);
 assert.equal(result.lines[0].cartQty,3);
 assert.equal(result.lines[0].quantity,2);
 assert.ok(result.changes.some(change=>change.type==='insufficient_stock'&&change.available===2&&change.requested===3));
});
test('restore keeps quantity and allowed discount and drops stale configuration',()=>{
 const result=reconcile({lines:[{...savedLine,obsoleteTrackingFlag:true}],products:[product],storeId:'s1',discountAllowed:true,discountLimit:15});
 assert.equal(result.lines[0].cartQty,3);
 assert.equal(result.lines[0].discountPercent,10);
 assert.equal(result.lines[0].obsoleteTrackingFlag,undefined);
 assert.equal(result.hasBlockingStockIssue,false);
 const denied=reconcile({lines:[savedLine],products:[product],storeId:'s1',discountAllowed:false});
 assert.equal(denied.lines[0].discountPercent,0);
 assert.ok(denied.changes.some(change=>change.type==='discount_changed'));
});
test('restore validates serial and batch selections against current product, store and availability',()=>{
 const current={...product,serializedUnits:[
  {id:'valid',serial:'CURRENT',storeId:'s1',status:'IN_STOCK'},
  {id:'sold',storeId:'s1',status:'SOLD'}, {id:'wrong-store',storeId:'s2',status:'IN_STOCK'},
  {id:'wrong-product',productId:'p2',storeId:'s1',status:'IN_STOCK'},
 ],stockBatches:[
  {id:'valid-batch',batchNo:'CURRENT-B',storeId:'s1',remaining:4},
  {id:'empty',storeId:'s1',remaining:0},{id:'other-store',storeId:'s2',remaining:5},
  {id:'other-product',productId:'p2',storeId:'s1',remaining:5},
 ]};
 const line={...savedLine,tracking:{serials:['valid','sold','wrong-store','wrong-product','missing'].map(id=>({id,serial:'OLD'})),batches:['valid-batch','empty','other-store','other-product','missing'].map(batchId=>({batchId,quantity:2,batchNo:'OLD'}))}};
 const input={lines:[line],products:[current],storeId:'s1'};
 const before=JSON.stringify(input);
 const result=reconcile(input);
 assert.deepEqual(result.lines[0].tracking.serials.map(row=>[row.id,row.serial]),[['valid','CURRENT']]);
 assert.deepEqual(result.lines[0].tracking.batches.map(row=>[row.batchId,row.batchNo,row.quantity]),[['valid-batch','CURRENT-B',2]]);
 assert.equal(result.changes.filter(change=>change.type==='serial_removed').length,4);
 assert.equal(result.changes.filter(change=>change.type==='batch_removed').length,4);
 assert.equal(JSON.stringify(input),before,'reconciliation must be pure');
});
test('restore rejects a selected batch that no longer covers its requested allocation',()=>{
 const result=reconcile({lines:[{...savedLine,tracking:{batches:[{batchId:'b1',quantity:3}]}}],products:[{...product,stockBatches:[{id:'b1',storeId:'s1',remaining:2}]}],storeId:'s1'});
 assert.deepEqual(result.lines[0].tracking.batches,[]);
 assert.ok(result.changes.some(change=>change.type==='batch_removed'));
});
test('restore uses explicit hydrated inventory and tracking rather than stale catalog totals',()=>{
 const result=reconcile({lines:[{...savedLine,tracking:{serials:[{id:'u1'}],batches:[]}}],products:[{...product,serializedUnits:[{id:'u1',storeId:'s1',status:'IN_STOCK'}]}],inventory:[{id:'p1',stockByStore:{s1:1}}],serials:[{id:'u1',productId:'p1',storeId:'s1',status:'SOLD'}],storeId:'s1'});
 assert.equal(result.lines[0].quantity,1);
 assert.deepEqual(result.lines[0].tracking.serials,[]);
 assert.equal(result.hasBlockingStockIssue,true);
});
test('draft persistence saves intent, not stale stock or tracking snapshots',()=>{
 const storage={setItem:(key,value)=>storage.value=value};
 savePosDraft(storage,'draft',{cart:[{...savedLine,stockByStore:{s1:999},serializedUnits:[{id:'old'}],stockBatches:[{id:'old'}],tracking:{serials:[{id:'selected'}],batches:[]}}]});
 const line=JSON.parse(storage.value).cart[0];
 assert.equal(line.cartQty,3);assert.equal(line.discountPercent,10);assert.equal(line.sellPrice,100);
 assert.equal(line.quantity,undefined);assert.equal(line.stockByStore,undefined);
 assert.equal(line.serializedUnits,undefined);assert.equal(line.taxRate,undefined);
 assert.deepEqual(line.tracking.serials,[{id:'selected'}]);
});
test('draft, local held cart and server held cart reconcile to identical outcomes',()=>{
 const storage={getItem:()=>storage.value,setItem:(key,value)=>storage.value=value};
 savePosDraft(storage,'draft',{cart:[savedLine]});
 const sources=[readPosDraft(storage,'draft'),{id:'local-1',cart:[savedLine]},{id:'server-1',cart:[savedLine]}];
 const results=sources.map(source=>reconcile({lines:source.cart,products:[product],storeId:'s1'}));
 assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);
 assert.equal(results[0].lines[0].sellPrice,120);
});
test('draft survives refresh, scoped per tenant/user/store',()=>{
 const store=new Map();const storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 const a=posDraftKey('A','cashier','store1'),b=posDraftKey('B','cashier','store1');
 assert.equal(savePosDraft(storage,a,{cart:[{id:'product',cartQty:3}]}),true);
 assert.equal(readPosDraft(storage,a).cart[0].cartQty,3);
 assert.equal(readPosDraft(storage,b),null);
 clearPosDraft(storage,a);assert.equal(readPosDraft(storage,a),null);
});
test('duplicate persisted lines cannot each claim the same stock independently',()=>{
 const result=reconcile({lines:[savedLine,{...savedLine,cartQty:3}],products:[product],storeId:'s1'});
 assert.equal(result.hasBlockingStockIssue,true);
 assert.deepEqual(result.lines.map(line=>line.cartQty),[3,3]);
 assert.ok(result.changes.some(change=>change.type==='insufficient_stock'&&change.requested===6&&change.available===5));
});
test('duplicate IDs block checkout even when stock covers all lines',()=>{
 const result=reconcile({lines:[{...savedLine,cartQty:1},{...savedLine,cartQty:1,discountPercent:5}],products:[product],storeId:'s1'});
 assert.equal(result.hasBlockingStockIssue,true);
 assert.ok(result.changes.some(change=>change.type==='duplicate_product'));
 assert.deepEqual(result.lines.map(line=>line.discountPercent),[10,5]);
});
test('allocation honors selected serial and batch instead of automatic first units',()=>{
 const current={id:'p',name:'Tracked',quantity:2,serializedUnits:[{id:'first',serial:'FIRST',storeId:'s1'},{id:'chosen',serial:'CHOSEN',storeId:'s1'}],stockBatches:[{id:'early',storeId:'s1',remaining:1,expiryDate:'2026-10-10'},{id:'chosen-b',storeId:'s1',remaining:1,expiryDate:'2026-11-10'}]};
 const result=allocateTrackedStock(current,'s1',1,{selection:{serials:[{id:'chosen'}],batches:[{batchId:'chosen-b',quantity:1}]}});
 assert.equal(result.success,true);
 assert.deepEqual(result.tracking.serials.map(row=>row.id),['chosen']);
 assert.deepEqual(result.tracking.batches.map(row=>[row.batchId,row.quantity]),[['chosen-b',1]]);
 assert.equal(result.product.serializedUnits[0].status,undefined);
 assert.equal(result.product.stockBatches[0].remaining,1);
 for(const selection of [{serials:[{id:'missing'}]},{batches:[{batchId:'missing',quantity:1}]},{serials:[{id:'chosen'},{id:'chosen'}]},{batches:[{batchId:'chosen-b',quantity:2}]}]){
  assert.equal(allocateTrackedStock(current,'s1',1,{selection}).success,false);
 }
});

test('Sales waits for bootstrap tracking and reconciles draft, local and server restores identically',async()=>{
 const React=await import('react');
 const {createRoot}=await import('react-dom/client');
 const {MemoryRouter}=await import('react-router-dom');
 const {JSDOM}=await import('jsdom');
 const {createServer}=await import('vite');
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost'});
 const previous={window:globalThis.window,document:globalThis.document,navigator:globalThis.navigator,act:globalThis.IS_REACT_ACT_ENVIRONMENT};
 globalThis.window=dom.window;globalThis.document=dom.window.document;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
 let root;
 try{
  const [{AuthProvider},{StoreProvider,useStore},{FeedbackProvider},{default:Sales},{api}]=await Promise.all([
   vite.ssrLoadModule('/src/context/AuthContext.jsx'),vite.ssrLoadModule('/src/context/StoreContext.jsx'),
   vite.ssrLoadModule('/src/context/FeedbackContext.jsx'),vite.ssrLoadModule('/src/pages/sales/Sales.jsx'),vite.ssrLoadModule('/src/services/apiClient.js'),
  ]);
  const storeId='11111111-1111-4111-8111-111111111111';
  const key=posDraftKey('org-1','owner-1',storeId);
  const saved={...savedLine,tracking:{serials:[{id:'u1',serial:'OLD'}],batches:[{batchId:'b1',quantity:2}]}};
  const current={...product,stockByStore:{[storeId]:5},metadata:{taxRate:12,name:'Metadata snapshot',sellPrice:777,stockByStore:{[storeId]:999},serializedUnits:[{id:'obsolete',storeId:'elsewhere'}]},serializedUnits:[{id:'u1',serial:'CURRENT',storeId,status:'IN_STOCK'}],stockBatches:[{id:'b1',storeId,batchNo:'CURRENT-B',remaining:5}]};
  const outcomes=[];
  for(const source of ['draft','local','server']){
   dom.window.localStorage.clear();
   const hold={id:source==='local'?'local-1':'held-1',name:'Saved order',cart:[saved],customer:'Buyer',note:'Keep intent',cartDiscountPct:0,total:270,createdAt:'2026-10-09T10:00:00Z'};
   if(source==='draft')savePosDraft(dom.window.localStorage,key,{...hold,payment:'card'});
   if(source==='local')dom.window.localStorage.setItem(`${key}:holds`,JSON.stringify([hold]));
   const original=dom.window.localStorage.getItem(key);
   let releaseBootstrap,bootstrapRequested=false,store;
   let bootstrap=new Promise(resolve=>releaseBootstrap=resolve);
   const calls=[];
   api.get=async path=>{
    calls.push(path);
    if(path==='/api/auth/me')return {user:{id:'owner-1',appRole:'OWNER',organizationId:'org-1',name:'Owner'}};
    if(path==='/api/users/me/sessions')return {sessions:[]};
    if(path==='/api/users')return {users:[]};
    if(path==='/api/bootstrap'){bootstrapRequested=true;return bootstrap;}
    if(path==='/api/settings')return {selectedStoreId:storeId,workspaceSettings:{pos:{defaultPayment:'card',discountLimit:15,holdCartEnabled:true}},businessFeatures:{},rolePermissions:{},uiPreferences:{}};
    if(path.startsWith('/api/sales/holds?'))return {holds:source==='server'?[hold]:[]};
    if(path==='/api/workspace/version')return {revision:'1'};
    throw new Error(`Unexpected GET ${path}`);
   };
   api.delete=async path=>{assert.equal(path,'/api/sales/holds/held-1');return {success:true};};
   api.patch=async path=>path==='/api/products/p1'?{product:{...current,serializedUnits:undefined,stockBatches:undefined,metadata:{taxRate:12}}}:{success:true};
   const Probe=()=>{store=useStore();return null;};
   const container=document.createElement('div');document.body.append(container);root=createRoot(container);
   await React.act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(StoreProvider,null,React.createElement(FeedbackProvider,null,React.createElement(MemoryRouter,null,React.createElement(Probe),React.createElement(Sales)))))));
   assert.equal(bootstrapRequested,true);
   await React.act(async()=>{await new Promise(resolve=>setTimeout(resolve,210));});
   assert.equal(dom.window.localStorage.getItem(key),original,'unhydrated restore must not overwrite persisted intent');
   assert.equal(calls.some(path=>path.startsWith('/api/sales/holds?')),false);
   assert.equal(container.querySelector('.checkout-primary').disabled,true);
   await React.act(async()=>releaseBootstrap({stores:[{id:storeId,name:'Main',active:true}],inventory:[current],organization:{id:'org-1',plan:'MONTHLY',storeLimit:2},activeShifts:{}}));
   assert.equal(store.workspaceReady,true);
   assert.equal(store.inventory[0].name,'Current phone');
   assert.equal(store.inventory[0].sellPrice,120);
   assert.equal(store.inventory[0].quantity,5);
   assert.deepEqual(store.inventory[0].serializedUnits,[{id:'u1',serial:'CURRENT',storeId,status:'IN_STOCK'}]);
   assert.deepEqual(store.inventory[0].stockBatches,[{id:'b1',storeId,batchNo:'CURRENT-B',remaining:5}]);
   if(source==='draft'){
    await React.act(async()=>{const savedProduct=await store.saveProduct({id:'p1',payload:current});assert.equal(savedProduct.success,true);});
    assert.deepEqual(store.inventory[0].serializedUnits,[{id:'u1',serial:'CURRENT',storeId,status:'IN_STOCK'}],'catalog-only edits must retain hydrated tracking');
    assert.deepEqual(store.inventory[0].stockBatches,[{id:'b1',storeId,batchNo:'CURRENT-B',remaining:5}]);
   }
   if(source!=='draft'){
    await React.act(async()=>container.querySelector('[aria-label="Savatni ushlab turish"]').click());
    await React.act(async()=>Array.from(container.querySelectorAll('button')).find(button=>button.textContent.startsWith('Saqlangan savatlar')).click());
    await React.act(async()=>Array.from(container.querySelectorAll('button')).find(button=>button.textContent==='Davom ettirish').click());
   }
   assert.match(container.querySelector('[role="status"]').textContent,/100.*120/);
   assert.match(container.querySelector('.pos-checkout').textContent,/Current phone/);
   await React.act(async()=>{await new Promise(resolve=>setTimeout(resolve,210));});
   const draft=readPosDraft(dom.window.localStorage,key);
   outcomes.push(draft.cart);
   assert.equal(draft.cart[0].cartQty,3);assert.equal(draft.cart[0].discountPercent,10);
   assert.deepEqual(draft.cart[0].tracking.serials.map(row=>[row.id,row.serial]),[['u1','CURRENT']]);
   assert.deepEqual(draft.cart[0].tracking.batches.map(row=>[row.batchId,row.batchNo,row.quantity]),[['b1','CURRENT-B',2]]);
   if(source==='draft'){
    const submitted=[];
    api.post=async(path,body)=>{assert.equal(path,'/api/sales');submitted.push(body);return {sale:{id:'committed',saleNumber:'1'}};};
    const refreshed={...current,name:'Renamed phone',sellPrice:160,serializedUnits:[{id:'first',serial:'FIRST',storeId,status:'IN_STOCK'},...current.serializedUnits],stockBatches:[{id:'early',storeId,remaining:1,expiryDate:'2026-10-10'},...current.stockBatches]};
    bootstrap=Promise.resolve({stores:[{id:storeId,name:'Main',active:true}],inventory:[refreshed],organization:{id:'org-1',plan:'MONTHLY',storeLimit:2},activeShifts:{[storeId]:{id:'shift',openedAtISO:'2026-10-09T10:00:00Z'}}});
    await React.act(async()=>store.reloadStore());
    assert.match(container.querySelector('.pos-checkout').textContent,/Renamed phone/);
    assert.match(container.querySelector('[role="status"]').textContent,/120.*160/);
    const notice=container.querySelector('[role="status"]').textContent;
    await React.act(async()=>store.reloadStore());
    assert.equal(container.querySelector('[role="status"]').textContent,notice,'identical refresh must not duplicate notices');
    await React.act(async()=>container.querySelector('.checkout-primary').click());
    assert.equal(submitted.length,0,'first checkout after refreshed catalog must stop for review');
    await React.act(async()=>container.querySelector('[aria-label="Miqdorni kamaytirish"]').click());
    // Quantity 2 now exactly matches the saved batch allocation and the two
    // tracked serials are partial legacy stock: preserve the selected unit.
    await React.act(async()=>container.querySelector('.checkout-primary').click());
    assert.equal(submitted.length,0,'quantity changes also require canonical tracking review');
    await React.act(async()=>container.querySelector('.checkout-primary').click());
    assert.equal(submitted.length,1);
    assert.equal(submitted[0].items[0].unitPrice,144);
    assert.deepEqual(submitted[0].items[0].metadata.tracking.serials.map(row=>row.id),['u1']);
    assert.deepEqual(submitted[0].items[0].metadata.tracking.batches.map(row=>[row.batchId,row.quantity]),[['b1',2]]);
   }
   if(source!=='draft'){
    bootstrap=Promise.resolve({stores:[{id:storeId,name:'Main',active:true}],inventory:source==='local'?[{...current,archived:true}]:[],organization:{id:'org-1',plan:'MONTHLY',storeLimit:2},activeShifts:{}});
    await React.act(async()=>store.reloadStore());
    assert.equal(container.querySelectorAll('.cart-item').length,0,'archived or deleted catalog products must be removed after held-cart restore');
    assert.match(container.querySelector('[role="status"]').textContent,/olib tashlandi/);
    assert.equal(container.querySelector('.checkout-primary').disabled,true);
   }
   await React.act(async()=>root.unmount());root=null;container.remove();
  }
  assert.deepEqual(outcomes[0],outcomes[1]);assert.deepEqual(outcomes[1],outcomes[2]);
 }finally{
  if(root)await React.act(async()=>root.unmount());
  await vite.close();dom.window.close();
  globalThis.window=previous.window;globalThis.document=previous.document;globalThis.IS_REACT_ACT_ENVIRONMENT=previous.act;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:previous.navigator});
 }
});
