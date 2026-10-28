// Read-only production smoke check. Does not authenticate or change customer data.
// Usage: node scripts/check-live-health.mjs https://www.zenixpos.uz
const base=process.argv[2];
if(!base){console.error("Usage: node scripts/check-live-health.mjs https://www.zenixpos.uz");process.exitCode=2}
else{
  const parsed=new URL(base);
  if(parsed.protocol!=="https:"||parsed.username||parsed.password||parsed.pathname!=="/"||parsed.search||parsed.hash)
    throw new Error("Supply an HTTPS origin without credentials, path, or query");
  let failures=0;
  for(const path of ["/health","/ready"]){
    const url=new URL(path,parsed);
    try{
      const response=await fetch(url,{method:"GET",signal:AbortSignal.timeout(12000),redirect:"error",headers:{"accept":"application/json","cache-control":"no-cache"}});
      const type=response.headers.get("content-type")||"";
      const raw=await response.text();
      let payload=null;try{payload=JSON.parse(raw)}catch{}
      const ok=response.ok&&type.toLowerCase().includes("json")&&payload!==null&&typeof payload==="object"&&payload.ok!==false;
      console.log(JSON.stringify({path,status:response.status,ok,contentType:type}));
      if(!ok)failures++;
    }catch(error){failures++;console.error(JSON.stringify({path,ok:false,error:String(error?.message||error)}))}
  }
  if(failures)process.exitCode=1;
}
