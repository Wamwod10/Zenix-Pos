import test from "node:test";
import assert from "node:assert/strict";
import {validateOrigin,classifyHealth,checkHealth} from "../scripts/check-live-health.mjs";

test("production smoke check requires an HTTPS origin without auth or query",()=>{
  assert.equal(validateOrigin("https://www.zenixpos.uz").origin,"https://www.zenixpos.uz");
  for(const raw of ["","http://www.zenixpos.uz","https://u:p@www.zenixpos.uz",
    "https://www.zenixpos.uz/api","https://www.zenixpos.uz/?secret=123"]){
    assert.throws(()=>validateOrigin(raw),{name:"Error"});
  }
});

test("health checker does not trust SPA HTML, generic JSON or false readiness",()=>{
  const check=(path,status,contentType,raw)=>classifyHealth(path,{status,contentType,raw}).ok;
  assert.equal(check("/health",200,"text/html","<html></html>"),false);
  assert.equal(check("/ready",200,"application/json",'{"ok":true}'),false);
  assert.equal(check("/ready",200,"application/json",'{"ok":true,"service":"zenix-pos-api","database":"down"}'),false);
  assert.equal(check("/health",503,"application/json",'{"ok":false,"service":"zenix-pos-api"}'),false);
  assert.equal(check("/health",200,"application/json",'{"ok":true,"service":"zenix-pos-api"}'),true);
  assert.equal(check("/ready",200,"application/json",'{"ok":true,"service":"zenix-pos-api","database":"ready"}'),true);
});

test("read-only smoke check calls both endpoints, never uses a write method",async()=>{
  const seen=[];
  const fetcher=async(url,options)=>{
    seen.push({url:url.pathname,method:options.method,redirect:options.redirect});
    return Response.json({ok:true,service:"zenix-pos-api",...(url.pathname==="/ready"?{database:"ready"}:{})});
  };
  const result=await checkHealth(validateOrigin("https://www.zenixpos.uz"),fetcher);
  assert.deepEqual(result.map(r=>r.ok),[true,true]);
  assert.deepEqual(seen,[
    {url:"/health",method:"GET",redirect:"error"},
    {url:"/ready",method:"GET",redirect:"error"}
  ]);
});

test("failed /ready check marks service unhealthy without hiding /health",async()=>{
  const fetcher=async(url)=>url.pathname==="/ready"
    ?Response.json({ok:false,service:"zenix-pos-api",database:"unavailable"},{status:503})
    :Response.json({ok:true,service:"zenix-pos-api"});
  const result=await checkHealth(validateOrigin("https://www.zenixpos.uz"),fetcher);
  assert.deepEqual(result.map(r=>r.ok),[true,false]);
  assert.equal(result[1].reason,"SERVICE_UNAVAILABLE");
});
