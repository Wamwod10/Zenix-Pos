import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {transformWithOxc} from 'vite';

test('shift reconciliation uses fresh server cash and blocks unavailable summaries',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
  const previous={window:globalThis.window,document:globalThis.document,act:globalThis.IS_REACT_ACT_ENVIRONMENT};
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  let expected=100000.10,fail=false,reads=0,closed;
  const store={activeShift:null,shiftHistory:[],dailySales:[{shiftId:'shift',total:1}],currentStore:{name:'Main'},currentStoreId:'store',hasPermission:()=>true,effectiveWorkspaceSettings:{organization:{},businessDay:{}},commitShiftClose:async input=>{closed=input.closedShift;return {success:true}},commitShiftOpen:async()=>({success:true}),commitShiftMovement:async()=>({success:true})};
  const ui=({children,...props})=>React.createElement('div',{},children);
  const harness={useAuth:()=>({currentUser:{id:'cashier',appRole:'CASHIER'}}),useStore:()=>store,useFeedback:()=>({confirm:async()=>true,notify:()=>{}}),useUnsavedGuard:()=>fn=>fn(),usePersistentColumns:()=>({visible:[],toggle(){},show:()=>false}),ROLES:{CASHIER:'CASHIER'},formatPrice:value=>String(value),saleNetPaymentBreakdown:()=>({cash:1,card:0,transfer:0}),saleNetRevenue:()=>1,formatWorkspaceDate:()=>'',workspaceDateISO:()=>'',workspaceBusinessDateISO:()=>'',workspaceTime:()=>'',PageHeader:ui,StatCard:({label,value})=>React.createElement('div',{},`${label}: ${value}`),StatusBadge:ui,PremiumSelect:'select',ColumnPicker:ui,Modal:({open,children,footer})=>open?React.createElement('div',{},children,footer):null,api:{get:async()=>{reads++;if(fail)throw Error('offline');return {summary:{shiftId:'shift',status:'open',expectedCash:expected,cashSales:expected,cashIn:0,cashOut:0}}}}};
  for(const name of ['FiArrowDownCircle','FiArrowUpCircle','FiBriefcase','FiClock','FiDollarSign','FiFileText','FiLock','FiPlus','FiSearch','FiTrendingUp'])harness[name]=()=>null;
  globalThis.__shiftHarness=harness;
  let source=fs.readFileSync(new URL('../src/pages/shifts/Shifts.jsx',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
  const reactUrl=pathToFileURL(path.resolve('node_modules/react/index.js')).href;
  source=`import {useCallback,useEffect,useRef,useState} from '${reactUrl}';\nconst {${Object.keys(harness).join(',')}}=globalThis.__shiftHarness;\n`+source;
  let {code}=await transformWithOxc(source,'Shifts.jsx',{jsx:{runtime:'automatic'}});
  code=code.replaceAll('"react/jsx-runtime"',JSON.stringify(pathToFileURL(path.resolve('node_modules/react/jsx-runtime.js')).href));
  let root;
  try{
    const {default:Shifts}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
    root=createRoot(document.getElementById('root'));
    await act(async()=>root.render(React.createElement(Shifts)));
    assert.match(document.body.textContent,/Smena hozir yopiq/);
    store.activeShift={id:'shift',cashierId:'cashier',openingCash:0,openedAtISO:new Date().toISOString(),cashMovements:[]};
    await act(async()=>root.render(React.createElement(Shifts)));
    assert.match(document.body.textContent,/Kutilayotgan naqd: 100000.1/);
    const click=async text=>act(async()=>[...document.querySelectorAll('button')].find(x=>x.textContent===text).click());
    await click('Smenani yopish');
    fail=true;
    await click('Smenani yopish');
    assert.match(document.body.textContent,/offline/);
    assert.equal(closed,undefined);
    assert.equal([...document.querySelectorAll('button')].filter(x=>x.textContent==='Smenani yopish').at(-1).disabled,true);
    fail=false;expected=200000.20;
    await click('Qayta yuklash');
    assert.match(document.body.textContent,/200000.2/);
    assert.ok(reads>=3);
  }finally{
    if(root)await act(async()=>root.unmount());
    globalThis.window=previous.window;globalThis.document=previous.document;globalThis.IS_REACT_ACT_ENVIRONMENT=previous.act;delete globalThis.__shiftHarness;dom.window.close();
  }
});
