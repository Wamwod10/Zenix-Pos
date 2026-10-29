import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/pages/platformAdmin/PlatformAdmin.jsx',import.meta.url),'utf8');
const start=source.indexOf('  const controlBusiness=async(action)=>{');
const end=source.indexOf('\n  };\n\n  return <div className="pro-page platform-pro">',start);

function makeControl({confirm,post}){
  assert.ok(start>=0&&end>start,'business action must be available for isolated regression');
  const ref={current:false},busy=[],notifications=[],posts=[];
  const values={
    detail:{id:'organization-fixture-1',name:'Synthetic organization'},
    detailLoaded:true,
    controlBusy:false,
    controlInFlightRef:ref,
    licenseForm:{reason:'Audit reason',plan:'ANNUAL',expiryDate:'2027-10-29',storeLimit:3},
    confirm,
    notify:notice=>notifications.push(notice),
    setControlBusy:value=>busy.push(value),
    api:{post:(url,body)=>{posts.push({url,body});return post(url,body)}},
    setDetail:()=>{},
    setLicenseForm:()=>{},
    reloadStore:async()=>{},
  };
  const body=source.slice(start,end+5);
  const action=new Function(...Object.keys(values),body+'\nreturn controlBusiness;')(...Object.values(values));
  return {action,ref,busy,notifications,posts};
}

test('Super Admin business controls acquire a synchronous lock before confirmation and release on cancel',async()=>{
  let finishConfirmation;
  let confirmCalls=0;
  const ctx=makeControl({
    confirm:()=>{confirmCalls++;return new Promise(resolve=>{finishConfirmation=resolve})},
    post:async()=>({organization:{}}),
  });
  const first=ctx.action('SUSPEND');
  await ctx.action('SEND_NOTICE');
  assert.equal(confirmCalls,1,'only one confirmation must open for rapid repeated clicks');
  assert.equal(ctx.posts.length,0,'no API write before approval');
  assert.equal(ctx.ref.current,true,'lock must be active while confirmation is open');
  assert.deepEqual(ctx.busy,[true],'disable action buttons immediately');
  finishConfirmation(false);
  await first;
  assert.equal(ctx.ref.current,false);
  assert.deepEqual(ctx.busy,[true,false],'cancel must restore controls');
  assert.equal(ctx.posts.length,0);
});

test('Super Admin business controls do not issue duplicate writes and recover after API failure',async()=>{
  let finishPost;
  let attempt=0;
  const ctx=makeControl({
    confirm:async()=>true,
    post:()=>{attempt++;return attempt===1?new Promise((resolve,reject)=>{finishPost=reject}):Promise.resolve({organization:{licenseStatus:'ACTIVE'}})},
  });
  const first=ctx.action('SET_LICENSE');
  await Promise.resolve();
  await ctx.action('PAYWALL');
  assert.equal(ctx.posts.length,1,'one write in flight even after confirmation');
  assert.equal(ctx.posts[0].url,'/api/platform/organizations/organization-fixture-1/control');
  assert.deepEqual(ctx.posts[0].body,{action:'SET_LICENSE',reason:'Audit reason',plan:'ANNUAL',expiryDate:'2027-10-29',storeLimit:3});
  finishPost(new Error('Synthetic API failure'));
  await first;
  assert.equal(ctx.ref.current,false);
  assert.equal(ctx.notifications.at(-1)?.tone,'danger');
  await ctx.action('RESTORE');
  assert.equal(ctx.posts.length,2,'actions can be retried after failed write');
  assert.equal(ctx.ref.current,false);
  assert.deepEqual(ctx.busy,[true,false,true,false]);
});

test('Super Admin business confirmation rejection releases lock without submitting',async()=>{
  const ctx=makeControl({confirm:async()=>{throw new Error('Synthetic dialog failure')},post:async()=>({organization:{}})});
  await ctx.action('SEND_NOTICE');
  assert.equal(ctx.posts.length,0);
  assert.equal(ctx.ref.current,false);
  assert.deepEqual(ctx.busy,[true,false]);
  assert.equal(ctx.notifications.at(-1)?.tone,'danger');
});
