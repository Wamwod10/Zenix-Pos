import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';

test('500-line cart skips row traversal for unrelated parent updates and keeps fresh actions',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
 const previous={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.__ppRowLists=0;
 const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent',plugins:[{name:'test-cart-traversal',enforce:'pre',transform(source,id){if(id.replaceAll('\\','/').endsWith('/src/pages/posPro/Cart.jsx'))return source.replace(/const CartLines=memo\(function CartLines\(([^)]*)\)\{/,'const CartLines=memo(function CartLines($1){globalThis.__ppRowLists++;')}}]});let root;
 try{
  const [{default:Cart},{createRoot}]=await Promise.all([vite.ssrLoadModule('/src/pages/posPro/Cart.jsx'),import('react-dom/client')]);root=createRoot(document.getElementById('root'));
  const cart=Array.from({length:500},(_,i)=>({id:String(i),name:'Item '+i,unit:'kg',sellPrice:1,cartQty:1,discountPercent:0})),calls=[];
  const session={cart,cartPct:0,locked:false,quantity:()=>assert.fail('stale action'),discount(){}};
  await act(()=>root.render(React.createElement(Cart,{session,canDiscount:true,onRemove(){}})));
  assert.equal(globalThis.__ppRowLists,1);
  await act(()=>root.render(React.createElement(Cart,{session:{...session,error:'unrelated search update',quantity:(...args)=>calls.push(args)},canDiscount:true,onRemove(){}})));
  assert.equal(globalThis.__ppRowLists,1,'unchanged cart must not map 500 rows again');
  await act(()=>document.querySelector('button[aria-label="Item 0 miqdorini oshirish"]').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
  assert.deepEqual(calls,[['0',1.05]]);
  await act(()=>root.render(React.createElement(Cart,{session:{...session,locked:true},canDiscount:true,onRemove(){}})));
  assert.equal(globalThis.__ppRowLists,2);assert.equal(document.querySelector('input').disabled,true);
 }finally{if(root)await act(()=>root.unmount());await vite.close();dom.window.close();Object.assign(globalThis,previous);delete globalThis.__ppRowLists}
});
