import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../src/pages/platformAdmin/PlatformTools.jsx',import.meta.url),'utf8');

function isolate(startToken,endToken,name,vars){
  const start=src.indexOf(startToken),end=src.indexOf(endToken,start);
  assert.ok(start>=0&&end>start,name+' function boundaries found');
  return new Function(...Object.keys(vars),src.slice(start,end+5)+'\nreturn '+name+';')(...Object.values(vars));
}

test('support diagnostics do not reveal a prior organization after switching while request is pending',async()=>{
  let deliver;
  const changes=[],busy=[],errors=[];
  const request={current:0},active={current:'org-1'};
  const diagnose=isolate('  const diagnose=async(page=0)=>{','\n  };\n  const copyOrganizationId','diagnose',{
    organization:{id:'org-1'},supportRequestRef:request,activeOrganizationRef:active,
    setBusy:x=>busy.push(x),setError:x=>errors.push(x),
    api:{get:()=>new Promise(resolve=>{deliver=resolve})},
    setSupport:x=>changes.push(x),setSupportPage:()=>{},
  });
  const previous=diagnose(0);
  active.current='org-2';request.current++;
  deliver({support:{apiIssues:[{id:'old-org-private-issue'}]}});
  await previous;
  assert.deepEqual(changes,[],'old tenant data must not be painted');
  assert.deepEqual(busy,[true],'old completion must not clear newer loading state');
  assert.deepEqual(errors,['']);
});

test('recovery backup and preview requests discard responses belonging to another organization',async()=>{
  for (const method of ['load','dryRun']){
    let deliver;
    const changes=[],busy=[];
    const request={current:0},active={current:'org-1'};
    const vars={
      organizationId:'org-1',page:0,requestRef:request,activeOrganizationRef:active,
      setBusy:x=>busy.push(x),setError:()=>{},setPreview:x=>changes.push(['preview',x]),
      setHistory:x=>changes.push(['history',x]),setPage:x=>changes.push(['page',x]),
      api:{get:()=>new Promise(resolve=>{deliver=resolve})},
    };
    const action=method==='load'
      ?isolate('  const load=async(next=page)=>{','\n  };\n  const dryRun','load',vars)
      :isolate('  const dryRun=async(snapshotId)=>{','\n  };\n  const displayDate','dryRun',vars);
    const first=method==='load'?action(0):action('snapshot-1');
    active.current='org-2';request.current++;
    deliver({backups:{snapshots:[{id:'previous-org'}]},preview:{organizationId:'org-1'}});
    await first;
    assert.ok(!changes.some(([key,value])=>key==='history'||key==='page'||key==='preview'&&value?.organizationId==='org-1'),method+' must ignore stale tenant results');
    assert.deepEqual(busy,[true],method+' must not change new organization loading state');
  }
});

test('organization changes and unmount invalidate diagnostic request generations and clear old data',()=>{
  const support=src.slice(src.indexOf('export function BusinessDiagnostics'),src.indexOf('export function RecoveryDashboard'));
  const recovery=src.slice(src.indexOf('export function RecoveryDashboard'));
  assert.match(support,/supportRequestRef\.current\+=1;\s*setSupport\(null\);setSupportPage\(0\);/);
  assert.match(support,/return \(\)=>\{supportRequestRef\.current\+=1\}/);
  assert.match(recovery,/requestRef\.current\+=1;\s*setHistory\(initialHistory\);/);
  assert.match(recovery,/return \(\)=>\{requestRef\.current\+=1\}/);
  assert.match(support,/activeOrganizationRef\.current!==organizationId/);
  assert.match(recovery,/activeOrganizationRef\.current!==id/);
});
