import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import proxyHandler from "../api/proxy.js";

const read=(path)=>fs.readFileSync(path,"utf8");

test("Vercel proxies API traffic same-origin so HttpOnly auth is not a third-party cookie",()=>{
  const config=JSON.parse(read("vercel.json"));
  const rewrites=config.rewrites||[];
  assert.ok(rewrites.some((rule)=>String(rule.source).startsWith("/api/")&&String(rule.destination).startsWith("/api/proxy")));
  const proxy=read("api/proxy.js");
  assert.match(proxy,/ZENIX_BACKEND_URL/);
  assert.match(proxy,/set-cookie/i);
  const client=read("src/services/apiClient.js");
  assert.match(client,/VITE_API_URL\|\|""/);
  assert.doesNotMatch(client,/API_NOT_CONFIGURED/);
});

test("Vercel proxy does not forward the browser Origin to the Render server",async()=>{
  const previousBackend=process.env.ZENIX_BACKEND_URL;
  const previousFetch=globalThis.fetch;
  let upstreamHeaders;
  process.env.ZENIX_BACKEND_URL="https://zenix-pos-backend.onrender.com";
  globalThis.fetch=async(_target,options)=>{
    upstreamHeaders=options.headers;
    return new Response(JSON.stringify({ok:true}),{status:200,headers:{"content-type":"application/json"}});
  };

  const responseHeaders=new Map();
  const req={
    method:"POST",
    url:"/api/proxy?path=auth/login",
    query:{path:"auth/login"},
    headers:{
      host:"www.zenixpos.uz",
      origin:"https://www.zenixpos.uz",
      "content-type":"application/json",
      "x-zenix-client":"web",
    },
    body:{login:"demo",password:"secret"},
  };
  const res={
    statusCode:0,
    setHeader(name,value){responseHeaders.set(name,value);},
    end(payload){this.payload=payload;},
  };

  try{
    await proxyHandler(req,res);
    assert.equal(upstreamHeaders.has("origin"),false);
  }finally{
    if(previousBackend===undefined)delete process.env.ZENIX_BACKEND_URL;
    else process.env.ZENIX_BACKEND_URL=previousBackend;
    globalThis.fetch=previousFetch;
  }
});

test("Vercel proxy removes the Expect header unsupported by Undici",async()=>{
  const previousBackend=process.env.ZENIX_BACKEND_URL;
  const previousFetch=globalThis.fetch;
  let upstreamHeaders;
  process.env.ZENIX_BACKEND_URL="https://zenix-pos-backend.onrender.com";
  globalThis.fetch=async(_target,options)=>{
    upstreamHeaders=options.headers;
    return new Response(JSON.stringify({ok:true}),{status:200,headers:{"content-type":"application/json"}});
  };

  const req={method:"POST",url:"/api/proxy?path=auth/login",query:{path:"auth/login"},headers:{host:"www.zenixpos.uz",expect:"100-continue","content-type":"application/json"},body:{}};
  const res={statusCode:0,setHeader(){},end(payload){this.payload=payload;}};

  try{
    await proxyHandler(req,res);
    assert.equal(upstreamHeaders.has("expect"),false);
  }finally{
    if(previousBackend===undefined)delete process.env.ZENIX_BACKEND_URL;
    else process.env.ZENIX_BACKEND_URL=previousBackend;
    globalThis.fetch=previousFetch;
  }
});

test("Vercel proxy exposes a safe failure reason when the upstream request throws",async()=>{
  const previousBackend=process.env.ZENIX_BACKEND_URL;
  const previousFetch=globalThis.fetch;
  process.env.ZENIX_BACKEND_URL="https://zenix-pos-backend.onrender.com";
  globalThis.fetch=async()=>{
    const error=new TypeError("fetch failed");
    error.cause={code:"ECONNRESET"};
    throw error;
  };

  const req={method:"POST",url:"/api/proxy?path=auth/login",query:{path:"auth/login"},headers:{host:"www.zenixpos.uz","content-type":"application/json"},body:{}};
  const res={statusCode:0,setHeader(){},end(payload){this.payload=payload;}};

  try{
    await proxyHandler(req,res);
    const payload=JSON.parse(String(res.payload));
    assert.equal(res.statusCode,502);
    assert.equal(payload.error.details.reason,"ECONNRESET");
  }finally{
    if(previousBackend===undefined)delete process.env.ZENIX_BACKEND_URL;
    else process.env.ZENIX_BACKEND_URL=previousBackend;
    globalThis.fetch=previousFetch;
  }
});

test("Render blueprint is available at repository root for backend deployment",()=>{
  const blueprint=read("../render.yaml");
  assert.match(blueprint,/rootDir:\s*backend/);
  assert.match(blueprint,/preDeployCommand:\s*npm run migrate/);
  assert.match(blueprint,/healthCheckPath:\s*\/ready/);
});

test("production documentation keeps Vercel browser API same-origin",()=>{
  const readme=read("../README.md");
  assert.match(readme,/ZENIX_BACKEND_URL/);
  assert.doesNotMatch(readme,/VITE_API_URL=https:\/\/your-api\.onrender\.com/);
});
