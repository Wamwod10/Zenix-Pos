import fs from "node:fs";
import path from "node:path";

const required=["package.json","package-lock.json","index.html","vite.config.js","vercel.json","api/proxy.js","src/main.jsx","public/sw.js"];
const missing=required.filter(file=>!fs.existsSync(file));
const violations=[];
if(fs.existsSync("backend")||fs.existsSync("frontend"))violations.push("Nested backend/frontend source is forbidden in the frontend repo root");
if(fs.existsSync("render.yaml"))violations.push("Render backend Blueprint belongs to the backend repository");
const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
if(pkg.name!=="zenix-pos-web")violations.push("Unexpected frontend package name");
const proxy=fs.readFileSync("api/proxy.js","utf8");
const vercel=JSON.parse(fs.readFileSync("vercel.json","utf8"));
if(!proxy.includes("ZENIX_BACKEND_URL"))violations.push("Backend proxy target env is missing");
if(!vercel.rewrites?.some(row=>String(row.destination).includes("/api/proxy")))violations.push("Vercel same-origin API proxy is missing");
const tracked=[];
for(const dir of ["src","public"]){
 if(!fs.existsSync(dir))continue;
 const scan=d=>{for(const entry of fs.readdirSync(d,{withFileTypes:true})){
  const p=path.join(d,entry.name);if(entry.isDirectory())scan(p);else if(/\.(?:js|jsx|scss|css|html)$/.test(p))tracked.push(p);
 }};scan(dir);
}
const source=tracked.map(p=>fs.readFileSync(p,"utf8")).join("\n");
if(/\bTechPro\b/i.test(source))violations.push("Legacy project branding is present");
if(/BACKEND_DISABLED|mockData/i.test(source))violations.push("Demo backend is present");
if(missing.length||violations.length){console.error(JSON.stringify({ok:false,missing,violations},null,2));process.exitCode=1;}
else console.log(JSON.stringify({ok:true,app:"Zenix POS frontend",files:tracked.length,standalone:true},null,2));
