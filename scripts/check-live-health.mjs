// Read-only external production smoke check.
// Run: node scripts/check-live-health.mjs https://www.zenixpos.uz
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";

export function validateOrigin(input){
  if(!input)throw new Error("HTTPS origin required");
  const origin=new URL(input);
  if(origin.protocol!=="https:"||origin.username||origin.password||origin.pathname!=="/"||origin.search||origin.hash)
    throw new Error("Supply an HTTPS origin without credentials, path, or query");
  return origin;
}

export function classifyHealth(path,{status,contentType,raw}){
  let json=null;
  try{json=JSON.parse(raw)}catch{}
  const valid=Number.isInteger(status)&&status>=200&&status<300
    &&String(contentType).toLowerCase().includes("application/json")
    &&json?.ok===true&&json?.service==="zenix-pos-api"
    &&(path!=="/ready"||json?.database==="ready");
  return {path,status,ok:valid,reason:valid?undefined:
    status>=500?"SERVICE_UNAVAILABLE":json?.ok===false?"NOT_READY":"INVALID_HEALTH_RESPONSE"};
}

export async function checkHealth(origin,fetcher=fetch){
  const results=[];
  for(const path of ["/health","/ready"]){
    try{
      const response=await fetcher(new URL(path,origin),{
        method:"GET",signal:AbortSignal.timeout(12000),redirect:"error",
        headers:{"accept":"application/json","cache-control":"no-cache"}
      });
      results.push(classifyHealth(path,{status:response.status,
        contentType:response.headers.get("content-type")||"",
        raw:await response.text()}));
    }catch(error){results.push({path,ok:false,reason:"REQUEST_FAILED",error:String(error?.message||error)})}
  }
  return results;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const origin=validateOrigin(process.argv[2]);
    const results=await checkHealth(origin);
    for(const result of results)console.log(JSON.stringify(result));
    if(results.some(row=>!row.ok))process.exitCode=1;
  }catch(error){console.error(String(error?.message||error));process.exitCode=2}
}
