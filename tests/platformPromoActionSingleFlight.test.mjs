import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/pages/platformAdmin/PlatformAdmin.jsx',import.meta.url),'utf8');

function makeActions({post,confirm}){
  const a=source.indexOf('  const savePromo=async()=>{'),b=source.indexOf('\n  const resetPassword=async()=>{',a);
  assert.ok(a>=0&&b>a,'promo handlers found');
  const ref={current:false},busy=[],writes=[],notices=[];
  const values={
    promoActionRef:ref,setPromoBusy:v=>busy.push(v),
    promo:{code:'SYNTHETIC',plan:'BOTH',percent:20,maxUses:3,perBusiness:1,startsAt:'',expiresAt:'',active:true},
    api:{post:(url,body)=>{writes.push({url,body});return post(url,body)}},
    setPromo:()=>{},loadPromos:async()=>{},notify:n=>notices.push(n),confirm,
  };
  const actions=new Function(...Object.keys(values),source.slice(a,b)+'\nreturn {savePromo,deactivatePromo};')(...Object.values(values));
  return {...actions,ref,busy,writes,notices};
}

test('promo creation and deactivation cannot submit twice before React re-renders',async()=>{
  let settle;
  const ctx=makeActions({post:()=>new Promise(resolve=>{settle=resolve}),confirm:async()=>true});
  const creation=ctx.savePromo();
  await ctx.savePromo();
  await ctx.deactivatePromo('promo-1');
  assert.equal(ctx.writes.length,1,'only initial promo POST should be sent');
  assert.equal(ctx.writes[0].url,'/api/platform/promos');
  assert.equal(ctx.ref.current,true);
  assert.deepEqual(ctx.busy,[true]);
  settle({});
  await creation;
  assert.deepEqual(ctx.busy,[true,false]);
  assert.equal(ctx.ref.current,false);
});

test('promo deactivation lock is acquired before confirmation and released on cancel',async()=>{
  let answer,prompts=0;
  const ctx=makeActions({
    post:async()=>({}),
    confirm:()=>{prompts++;return new Promise(resolve=>{answer=resolve})},
  });
  const first=ctx.deactivatePromo('promo/A');
  await ctx.deactivatePromo('promo/B');
  await ctx.savePromo();
  assert.equal(prompts,1,'one confirmation during rapid interaction');
  assert.equal(ctx.writes.length,0,'never mutate without confirmation');
  answer(false);
  await first;
  assert.equal(ctx.ref.current,false);
  assert.deepEqual(ctx.busy,[true,false]);
});

test('failed promo action unlocks controls for retry, with safe encoded ID',async()=>{
  let count=0;
  const ctx=makeActions({post:async()=>{count++;if(count===1)throw new Error('Synthetic failure');return {}},confirm:async()=>true});
  await ctx.deactivatePromo('promo/A');
  assert.equal(ctx.ref.current,false);
  assert.equal(ctx.notices.at(-1)?.tone,'danger');
  await ctx.deactivatePromo('promo/A');
  assert.equal(ctx.writes.length,2);
  assert.equal(ctx.writes[1].url,'/api/platform/promos/promo%2FA/deactivate');
  assert.deepEqual(ctx.busy,[true,false,true,false]);
});

test('promo deactivation actions are disabled while any promo write is pending',()=>{
  assert.match(source,/disabled=\{promoBusy\} onClick=\{\(\)=>deactivatePromo\(item\.id\)\}/);
  assert.match(source,/if\(promoActionRef\.current\)return;/);
});
