import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('expense receipt loads ignore stale files across selection, modal close and branch switch',async()=>{
 const source=readFileSync(new URL('../src/pages/expenses/Expenses.jsx',import.meta.url),'utf8');
 const start=source.indexOf('  const openReceipt=async expense=>{');
 const end=source.indexOf('  return <div className="pro-page expenses-pro">',start);
 assert.ok(start>=0&&end>start,'receipt handlers found');
 const pending=new Map(),urls=[],loading=[],created=[];
 const request={current:0},scope={current:'org:a'};
 const setup=new Function('receiptRequestRef','branchScopeRef','setReceiptView','setReceiptUrl','setReceiptError','setReceiptLoading','readLocalFile','URL',source.slice(start,end)+'\nreturn {openReceipt,closeReceipt};');
 const {openReceipt,closeReceipt}=setup(request,scope,()=>{},v=>urls.push(v),()=>{},v=>loading.push(v),key=>new Promise(resolve=>pending.set(key,resolve)),{createObjectURL:blob=>{created.push(blob.id);return 'blob:'+blob.id}});
 const old=openReceipt({id:'old',receiptKey:'old'});
 const current=openReceipt({id:'current',receiptKey:'current'});
 pending.get('old')({id:'old'});await old;
 assert.deepEqual(created,[],'old receipt must not create a blob URL');
 assert.equal(loading.at(-1),true,'stale completion must not finish active loading');
 pending.get('current')({id:'current'});await current;
 assert.deepEqual(created,['current']);
 assert.equal(urls.at(-1),'blob:current');
 assert.equal(loading.at(-1),false);
 const closing=openReceipt({id:'closing',receiptKey:'closing'});
 closeReceipt();pending.get('closing')({id:'closing'});await closing;
 assert.deepEqual(created,['current'],'closed receipt must not reopen');
 const priorBranch=openReceipt({id:'prior',receiptKey:'prior'});
 scope.current='org:b';pending.get('prior')({id:'prior'});await priorBranch;
 assert.deepEqual(created,['current'],'previous branch receipt must not appear');
});
