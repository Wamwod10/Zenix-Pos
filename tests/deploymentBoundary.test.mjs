import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

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
