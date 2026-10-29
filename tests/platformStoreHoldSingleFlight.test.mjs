import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/pages/platformAdmin/PlatformAdmin.jsx',import.meta.url),'utf8');
const start=source.indexOf('  const changeStoreHold=async(store,action)=>{');
const end=source.indexOf('\n  };\n  const [resetTarget,setResetTarget]=useState(null);',start);

function setup({confirm,post}){
  assert.ok(start>=0&&end>start,'store hold action source must be found');
  const lock={current:false},busy=[],posts=[],notifications=[],reasons=[];
  const vars={
    detail:{id:'test-org',name:'Synthetic company'},
    storeHoldBusy:false,
    storeHoldInFlightRef:lock,
    storeHoldReason:'Verified support reason',
    confirm,
    notify:message=>notifications.push(message),
    setStoreHoldBusy:value=>busy.push(value),
    api:{post:(url,body)=>{posts.push({url,body});return post(url,body)}},
    setStoreHoldReason:value=>reasons.push(value),
    showRecoveryPreview:async()=>{},
  };
  const code=source.slice(start,end+5);
  const action=new Function(...Object.keys(vars),code+'\nreturn changeStoreHold;')(...Object.values(vars));
  return {action,lock,busy,posts,notifications,reasons};
}

test('store HOLD confirmation opens once under rapid double-click and cancellation unlocks controls',async()=>{
  let resolveDialog,dialogs=0;
  const ctx=setup({confirm:()=>{dialogs++;return new Promise(resolve=>{resolveDialog=resolve})},post:async()=>({})});
  const store={id:'test-store',name:'Synthetic branch'};
  const first=ctx.action(store,'HOLD');
  await ctx.action(store,'RELEASE');
  assert.equal(dialogs,1);
  assert.equal(ctx.posts.length,0);
  assert.equal(ctx.lock.current,true);
  assert.deepEqual(ctx.busy,[true]);
  resolveDialog(false);
  await first;
  assert.equal(ctx.lock.current,false);
  assert.deepEqual(ctx.busy,[true,false]);
  assert.equal(ctx.posts.length,0);
});

test('store trading HOLD request is single-flight, encodes identifiers and retries after failure',async()=>{
  let rejectFirst,postCount=0;
  const ctx=setup({confirm:async()=>true,post:()=>{postCount++;return postCount===1?new Promise((resolve,reject)=>{rejectFirst=reject}):Promise.resolve({})}});
  const store={id:'store/special',name:'Synthetic branch'};
  const first=ctx.action(store,'HOLD');
  await Promise.resolve();
  await ctx.action(store,'RELEASE');
  assert.equal(ctx.posts.length,1);
  assert.equal(ctx.posts[0].url,'/api/platform/organizations/test-org/stores/store%2Fspecial/trading-hold');
  assert.deepEqual(ctx.posts[0].body,{action:'HOLD',reason:'Verified support reason'});
  rejectFirst(new Error('Synthetic request rejection'));
  await first;
  assert.equal(ctx.lock.current,false);
  assert.equal(ctx.notifications.at(-1)?.tone,'danger');
  await ctx.action(store,'RELEASE');
  assert.equal(ctx.posts.length,2);
  assert.equal(ctx.posts[1].body.action,'RELEASE');
  assert.deepEqual(ctx.busy,[true,false,true,false]);
});

test('a broken confirmation dialog unlocks store controls without issuing an API request',async()=>{
  const ctx=setup({confirm:async()=>{throw new Error('Synthetic confirmation error')},post:async()=>({})});
  await ctx.action({id:'test-store',name:'Synthetic branch'},'HOLD');
  assert.equal(ctx.posts.length,0);
  assert.equal(ctx.lock.current,false);
  assert.deepEqual(ctx.busy,[true,false]);
  assert.equal(ctx.notifications.at(-1)?.tone,'danger');
});
