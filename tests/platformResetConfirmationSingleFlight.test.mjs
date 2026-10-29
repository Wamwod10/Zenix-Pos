import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/pages/platformAdmin/PlatformAdmin.jsx',import.meta.url),'utf8');

function makeFixture({confirm,post}){
  const lock={current:null},request={current:0},busy=[],calls=[],notices=[],tokens=[];
  const vars={
    detail:{id:'test-organization'},resetTarget:{id:'test-user'},
    resetBusy:false,resetActionInFlightRef:lock,resetRequestRef:request,
    resetForm:{reason:'Verified admin support reason',password:'SyntheticPassword123'},
    confirm,notify:msg=>notices.push(msg),setResetBusy:value=>busy.push(value),
    api:{post:(url,data)=>{calls.push({url,data});return post(url,data)}},
    setResetToken:value=>tokens.push(value),
    closeReset:()=>{request.current++;lock.current=null;busy.push(false);},
  };
  const create=(startText,endText,name)=>{
    const start=source.indexOf(startText),end=source.indexOf(endText,start);
    assert.ok(start>=0&&end>start,'Cannot find '+name+' action source');
    const snippet=source.slice(start,end+5);
    return new Function(...Object.keys(vars),snippet+'\nreturn '+name+';')(...Object.values(vars));
  };
  return {...vars,lock,request,busy,calls,notices,tokens,
    issueToken:create('  const issueResetToken=async()=>{','\n  };\n  const loadPromos=','issueResetToken'),
    resetPassword:create('  const resetPassword=async()=>{','\n  };\n  const {visible:paymentColumns','resetPassword'),
  };
}

test('reset-token and password modes share one lock before confirmation',async()=>{
  let resolveDialog,count=0;
  const ctx=makeFixture({
    confirm:()=>{count++;return new Promise(resolve=>{resolveDialog=resolve})},
    post:async()=>({reset:{token:'synthetic'}}),
  });
  const first=ctx.issueToken();
  await ctx.resetPassword();
  assert.equal(count,1,'cross-mode rapid clicks must not open two confirmations');
  assert.equal(ctx.calls.length,0);
  assert.ok(ctx.lock.current);
  assert.deepEqual(ctx.busy,[true]);
  resolveDialog(false);
  await first;
  assert.equal(ctx.lock.current,null);
  assert.deepEqual(ctx.busy,[true,false]);
});

test('reset-token requests serialize pending writes and a failure unlocks the action',async()=>{
  let failPost,attempt=0;
  const ctx=makeFixture({
    confirm:async()=>true,
    post:()=>{attempt++;return attempt===1?new Promise((resolve,reject)=>{failPost=reject}):Promise.resolve({reset:{token:'synthetic'}})},
  });
  const first=ctx.issueToken();
  await Promise.resolve();
  await ctx.issueToken();
  assert.equal(ctx.calls.length,1);
  assert.equal(ctx.calls[0].url,'/api/platform/organizations/test-organization/users/test-user/reset-token');
  assert.deepEqual(ctx.calls[0].data,{reason:'Verified admin support reason',identityVerified:true});
  failPost(new Error('Synthetic request error'));
  await first;
  assert.equal(ctx.lock.current,null);
  assert.equal(ctx.notices.at(-1)?.tone,'danger');
  await ctx.issueToken();
  assert.equal(ctx.calls.length,2);
  assert.deepEqual(ctx.tokens,[{token:'synthetic'}]);
});

test('password reset does not duplicate and unlocks after successful reset closes its modal',async()=>{
  const ctx=makeFixture({confirm:async()=>true,post:async()=>({})});
  await ctx.resetPassword();
  assert.equal(ctx.calls.length,1);
  assert.equal(ctx.calls[0].url,'/api/platform/organizations/test-organization/users/test-user/reset-password');
  assert.equal(ctx.calls[0].data.identityVerified,true);
  assert.equal(ctx.calls[0].data.password,'SyntheticPassword123');
  assert.equal(ctx.request.current,1);
  assert.equal(ctx.lock.current,null);
  assert.equal(ctx.notices.at(-1)?.tone,'success');
});

test('closing reset dialog before confirmation resolves prevents stale write',async()=>{
  let resolveDialog;
  const ctx=makeFixture({confirm:()=>new Promise(resolve=>{resolveDialog=resolve}),post:async()=>({})});
  const pending=ctx.resetPassword();
  ctx.closeReset();
  resolveDialog(true);
  await pending;
  assert.equal(ctx.calls.length,0);
  assert.equal(ctx.lock.current,null);
});
