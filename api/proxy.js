const HOP_BY_HOP_HEADERS=new Set([
  "connection","keep-alive","proxy-authenticate","proxy-authorization","te","trailer","transfer-encoding","upgrade","host","content-length","expect"
]);
const FORWARDED_REQUEST_HEADERS=new Set([
  "accept","accept-language","authorization","content-type","cookie","if-match","if-none-match","user-agent",
  "x-file-name","x-telegram-bot-api-secret-token","x-zenix-client"
]);

// Accept only a configured HTTPS origin (or loopback HTTP for development).
// Never permit credentials, paths or query parameters in the upstream base URL.
function backendOrigin(value) {
  if (!String(value || '').trim()) return null;
  try {
    const parsed = new URL(String(value).trim());
    const localhost = new Set(['localhost', '127.0.0.1', '[::1]']);
    if ((parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && localhost.has(parsed.hostname))) ||
        parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return null;
    return parsed.origin;
  } catch { return null; }
}

async function readRequestBody(req){
  if(req.method==="GET"||req.method==="HEAD")return undefined;
  if(req.body!==undefined&&req.body!==null){
    if(Buffer.isBuffer(req.body))return req.body;
    if(typeof req.body==="string")return Buffer.from(req.body);
    if(req.body instanceof Uint8Array)return Buffer.from(req.body);
    const contentType=String(req.headers["content-type"]||"").toLowerCase();
    if(contentType.includes("application/json"))return Buffer.from(JSON.stringify(req.body));
  }
  const chunks=[];
  for await(const chunk of req)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));
  return chunks.length?Buffer.concat(chunks):undefined;
}

function upstreamPath(rawPath){
  const path=String(rawPath||'').replace(/^\/+/, '');
  // Prevent traversal, double-decoding and accidental injection into the target URL.
  if (!path || !/^[A-Za-z0-9._~/-]+$/.test(path) ||
      path.split('/').some(part => part === '.' || part === '..' || part === '')) return null;
  if (path === 'health' || path === 'ready') return `/${path}`;
  return `/api/${path}`;
}

export default async function handler(req,res){
  const backend=backendOrigin(process.env.ZENIX_BACKEND_URL);
  if(!backend){
    res.statusCode=503;
    res.setHeader("content-type","application/json; charset=utf-8");
    return res.end(JSON.stringify({ok:false,error:{code:"BACKEND_NOT_CONFIGURED",message:"Zenix POS backend manzili sozlanmagan"}}));
  }

  const rawPath=Array.isArray(req.query?.path)?req.query.path.join("/"):req.query?.path;
  const suffix=upstreamPath(rawPath);
  if (!suffix) {
    res.statusCode=400;
    res.setHeader('content-type','application/json; charset=utf-8');
    return res.end(JSON.stringify({ok:false,error:{code:'INVALID_PROXY_PATH',message:'API yo‘li noto‘g‘ri'}}));
  }
  const originalUrl=new URL(req.url||"/",`https://${req.headers.host||"localhost"}`);
  originalUrl.searchParams.delete("path");
  const query=originalUrl.searchParams.toString();
  const target=`${backend}${suffix}${query?`?${query}`:""}`;

  const headers=new Headers();
  for(const [key,value] of Object.entries(req.headers||{})){
    const lower=String(key).toLowerCase();
    if(!FORWARDED_REQUEST_HEADERS.has(lower)||HOP_BY_HOP_HEADERS.has(lower)||value===undefined)continue;
    if(Array.isArray(value))for(const item of value)headers.append(key,String(item));
    else headers.set(key,String(value));
  }
  headers.delete("origin");
  headers.set("x-zenix-proxy","vercel");
  if(req.headers.host)headers.set("x-forwarded-host",String(req.headers.host));
  headers.set("x-forwarded-proto","https");

  try{
    const body=await readRequestBody(req);
    const upstream=await fetch(target,{method:req.method||"GET",headers,body,redirect:"manual",signal:AbortSignal.timeout(20_000)});
    res.statusCode=upstream.status;

    for(const [key,value] of upstream.headers.entries()){
      const lower=key.toLowerCase();
      if(HOP_BY_HOP_HEADERS.has(lower)||lower==="set-cookie"||lower==="content-encoding"||lower==="content-length")continue;
      res.setHeader(key,value);
    }
    const getSetCookie=upstream.headers.getSetCookie?.bind(upstream.headers);
    const cookies=getSetCookie?getSetCookie():[];
    if(cookies.length)res.setHeader("set-cookie",cookies);
    else{
      const cookie=upstream.headers.get("set-cookie");
      if(cookie)res.setHeader("set-cookie",cookie);
    }
    res.setHeader("cache-control","no-store");
    const payload=Buffer.from(await upstream.arrayBuffer());
    return res.end(payload);
  }catch(error){
    const candidate=String(error?.cause?.code||error?.code||"").trim();
    const reason=/^[A-Z][A-Z0-9_]{1,63}$/.test(candidate)?candidate:"UPSTREAM_REQUEST_FAILED";
    res.statusCode=502;
    res.setHeader("content-type","application/json; charset=utf-8");
    res.setHeader("cache-control","no-store");
    return res.end(JSON.stringify({ok:false,error:{code:"BACKEND_UNAVAILABLE",message:"Zenix POS backend bilan bog‘lanib bo‘lmadi",details:{reason}}}));
  }
}
