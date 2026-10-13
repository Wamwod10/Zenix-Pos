import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';

test('warehouse selection and delayed responses stay within the current branch',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
  const previous={window:globalThis.window,document:globalThis.document,act:globalThis.IS_REACT_ACT_ENVIRONMENT};
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
  let root;
  try{
    const [{default:useWarehouses},{default:WarehouseSelector},{api},{createRoot}]=await Promise.all([vite.ssrLoadModule('/src/utils/useWarehouses.js'),vite.ssrLoadModule('/src/components/WarehouseSelector.jsx'),vite.ssrLoadModule('/src/services/apiClient.js'),import('react-dom/client')]);
    let state,resolveOld,oldSignal,resolveSave,saveSignal;
    const writes=[];
    api.post=async(path,body,{signal})=>{writes.push({path,body});saveSignal=signal;return new Promise(resolve=>{resolveSave=resolve})};
    api.patch=async(path,body)=>{writes.push({path,body});return {warehouse:{id:'b-new',store_id:'b',name:body.name}}};
    api.get=async(path,{signal})=>{
      const store=new URL(path,'http://localhost').searchParams.get('storeId');
      if(store==='a'){oldSignal=signal;return new Promise(resolve=>{resolveOld=resolve})}
      return {warehouses:[{id:'b-default',store_id:'b',name:'Branch default',is_default:true},{id:'b-new',store_id:'b',name:'Empty'}],balances:[{warehouse_id:'b-default',product_id:'p',quantity:7}]};
    };
    function Probe({storeId}){state=useWarehouses({organizationId:'org',storeId});return React.createElement(WarehouseSelector,{state,canEdit:true})}
    root=createRoot(document.getElementById('root'));
    await act(async()=>root.render(React.createElement(Probe,{storeId:'a'})));
    await act(async()=>root.render(React.createElement(Probe,{storeId:'b'})));
    assert.equal(oldSignal.aborted,true);
    assert.equal(state.selectedId,'b-default');
    await act(async()=>resolveOld({warehouses:[{id:'a',store_id:'a',name:'Old'}],balances:[{warehouse_id:'a',product_id:'p',quantity:99}]}));
    assert.equal(state.selectedId,'b-default');assert.equal(state.balances[0].quantity,7);
    await act(async()=>state.setSelectedId('b-new'));
    assert.equal(state.selectedId,'b-new');
    assert.equal(document.body.textContent.includes('Old'),false);
    assert.ok(document.body.textContent.includes('Empty'));
    await act(async()=>state.setSelectedId('a'));
    assert.equal(state.selectedId,'b-new','reject an ID outside the selected branch');
    const click=async text=>act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent===text).click());
    const enterName=async value=>act(async()=>{
      const input=document.querySelector('[role="dialog"] input');
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,value);
      input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
    });
    await click('Nomini o‘zgartirish');
    await enterName('Renamed');await click('Saqlash');
    assert.deepEqual(writes[0],{path:'/api/warehouses/b-new',body:{name:'Renamed'}});
    await click('Ombor qo‘shish');await enterName('New warehouse');await click('Saqlash');
    assert.deepEqual(writes[1],{path:'/api/warehouses',body:{storeId:'b',name:'New warehouse'}});
    await act(async()=>root.render(React.createElement(Probe,{storeId:'a'})));
    assert.equal(saveSignal.aborted,true);
    assert.equal(state.balances.length,0,'old branch balances disappear while the next request is pending');
    await act(async()=>resolveSave({warehouse:{id:'created',store_id:'b',name:'New warehouse'}}));
    assert.equal(document.querySelector('[role="dialog"]'),null);
    assert.equal(state.warehouses.length,0,'old mutation response cannot populate the new branch');
  }finally{
    if(root)await act(async()=>root.unmount());await vite.close();dom.window.close();
    globalThis.window=previous.window;globalThis.document=previous.document;globalThis.IS_REACT_ACT_ENVIRONMENT=previous.act;
  }
});

test('Inventory displays named warehouse balances and an empty warehouse starts at zero',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
  const old={window:globalThis.window,document:globalThis.document,act:globalThis.IS_REACT_ACT_ENVIRONMENT,resize:globalThis.ResizeObserver,frame:globalThis.requestAnimationFrame};
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);
  const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});let root;
  try{
    const [{AuthProvider},{StoreProvider,useStore},{FeedbackProvider},{default:Inventory},{api},{createRoot},{MemoryRouter}]=await Promise.all([vite.ssrLoadModule('/src/context/AuthContext.jsx'),vite.ssrLoadModule('/src/context/StoreContext.jsx'),vite.ssrLoadModule('/src/context/FeedbackContext.jsx'),vite.ssrLoadModule('/src/pages/inventory/Inventory.jsx'),vite.ssrLoadModule('/src/services/apiClient.js'),import('react-dom/client'),import('react-router-dom')]);
    api.get=async path=>{
      if(path==='/api/auth/me')return {user:{id:'owner',organizationId:'org',appRole:'OWNER'}};
      if(path==='/api/bootstrap')return {stores:[{id:'a',name:'Main'}],inventory:[{id:'11111111-1111-4111-8111-111111111111',name:'Item',barcode:'123',unit:'dona',avg_cost:10,metadata:{packaging:[{unit:'quti',factor:24,salePrice:15000}]},stock_by_store:{a:99}},{id:'33333333-3333-4333-8333-333333333333',name:'Other',barcode:'999',stock_by_store:{a:5}}],organization:{id:'org',licenseStatus:'ACTIVE',accessMode:'READ_WRITE'}};
      if(path==='/api/settings')return {selectedStoreId:'a'};
      if(path.startsWith('/api/warehouses'))return {warehouses:[{id:'default',store_id:'a',name:'Main warehouse',is_default:true},{id:'empty',store_id:'a',name:'Empty warehouse'}],balances:[{warehouse_id:'default',product_id:'11111111-1111-4111-8111-111111111111',quantity:7}]};
      return {revision:1,items:[],users:[],sessions:[]};
    };
    function Ready(){return useStore().workspaceReady?React.createElement(Inventory):null}
    root=createRoot(document.getElementById('root'));
    await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(StoreProvider,null,React.createElement(FeedbackProvider,null,React.createElement(MemoryRouter,null,React.createElement(Ready)))))));
    assert.equal(document.querySelector('.inv-qty strong')?.textContent,'7');
    await act(async()=>document.querySelector('.warehouse-selector button[aria-label="Ombor"]').click());
    await act(async()=>[...document.querySelectorAll('[role="option"]')].find(option=>option.textContent.includes('Empty warehouse')).click());
    assert.equal(document.querySelectorAll('.inventory-card-pro').length,0);
    assert.ok(document.body.textContent.includes('Ombor qo‘shish'));
    let receipt;
    api.post=async(path,body)=>{if(path==='/api/inventory/receive'){receipt=body;return {receiptId:'22222222-2222-4222-8222-222222222222',updated:[{productId:'11111111-1111-4111-8111-111111111111',name:'Item',quantity:48,avgCost:500}],total:24000}}return {}};
    await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent===' Kirim').click());
    await act(async()=>{const input=document.querySelector('[aria-label="Kirim mahsulotini qidirish"]');Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,'123');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}))});
    await act(async()=>document.querySelector('[role="dialog"] .receive-product-picker .premium-select').click());
    assert.equal([...document.querySelectorAll('[role="option"]')].some(option=>option.textContent.includes('Other')),false);
    await act(async()=>[...document.querySelectorAll('[role="option"]')].find(option=>option.textContent.includes('Item')).click());
    assert.ok(document.querySelector('[aria-label="Kirim mahsulotini qidirish"]'));
    const dialog=()=>document.querySelector('[role="dialog"]');
    const field=label=>[...dialog().querySelectorAll('label.pro-field')].find(node=>node.querySelector('span')?.textContent===label);
    await act(async()=>field('Kirim birligi').querySelector('button').click());
    await act(async()=>[...document.querySelectorAll('[role="option"]')].find(option=>option.textContent.includes('quti')).click());
    const enter=async(label,value)=>act(async()=>{const input=field(label).querySelector('input');Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}))});
    await enter('Miqdor *','2');await enter('Bir qadoq tannarxi *','12000');
    await act(async()=>[...dialog().querySelectorAll('button')].find(button=>button.textContent==='Saqlash va yana kirim').click());
    assert.equal(receipt.warehouseId,'empty');
    assert.equal(receipt.lines[0].quantity,48);assert.equal(receipt.lines[0].costPrice,500);
    assert.ok(dialog(),'save and another keeps a new receipt dialog open');
    assert.equal(field('Miqdor *').querySelector('input').value,'');
    await act(async()=>dialog().querySelector('[aria-label="Yopish"]').click());
    await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent===' Tezkor kirim').click());
    for(let scan=0;scan<2;scan++){
      await act(async()=>{const input=document.querySelector('[aria-label="Tezkor shtrix-kod"]');Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,'123');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}))});
      await act(async()=>document.querySelector('[aria-label="Tezkor shtrix-kod"]').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
    }
    assert.equal(document.querySelector('.quick-receive-row input[type="number"]').value,'2');
    assert.equal(document.querySelectorAll('.quick-receive-row').length,1);
  }finally{
    if(root)await act(async()=>root.unmount());await vite.close();dom.window.close();globalThis.window=old.window;globalThis.document=old.document;globalThis.IS_REACT_ACT_ENVIRONMENT=old.act;globalThis.ResizeObserver=old.resize;globalThis.requestAnimationFrame=old.frame;
  }
});
