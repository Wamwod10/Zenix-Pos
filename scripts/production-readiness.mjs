import fs from "node:fs";
import path from "node:path";

const frontendRoot=process.cwd();
const repoRoot=path.resolve(frontendRoot,"..");
const resolveProjectPath=(file)=>file.startsWith("../")?path.join(repoRoot,file.slice(3)):path.join(frontendRoot,file);
const read=(file)=>fs.readFileSync(resolveProjectPath(file),"utf8");
const fail=[];
const required=[
  "vercel.json",".env.example","../README.md",
  "../backend/package.json","../backend/render.yaml","../backend/.env.example",
  "../backend/src/app.js","../backend/src/server.js","../backend/src/config/env.js",
  "../backend/scripts/setTelegramWebhook.js",
  "../backend/migrations/001_initial.sql",
  "../backend/migrations/002_remove_trial_mode.sql",
  "../backend/migrations/003_notification_delivery_hardening.sql",
  "../backend/migrations/004_transfer_tracking.sql",
  "../backend/migrations/005_production_security.sql",
  "../backend/migrations/006_return_business_day.sql",
  "../backend/migrations/007_registration_throttle.sql",
  "../backend/migrations/008_serial_case_insensitive_unique.sql",
];
for(const file of required)if(!fs.existsSync(resolveProjectPath(file)))fail.push(`missing ${file}`);

const sourceRoots=["src","public","../backend/src","../backend/scripts"];
const files=[];
for(const dir of sourceRoots){
  const base=resolveProjectPath(dir);if(!fs.existsSync(base))continue;
  const walk=(folder)=>{for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const full=path.join(folder,entry.name);if(entry.isDirectory())walk(full);else if(/\.(?:js|jsx|mjs|json|html|scss|css|webmanifest)$/.test(entry.name))files.push(full)}};
  walk(base);
}
const text=files.map((file)=>fs.readFileSync(file,"utf8")).join("\n");
if(/\bTechPro\b/i.test(text))fail.push("legacy TechPro branding remains in runtime source");
if(/\b(?:localStorage|sessionStorage|indexedDB)\b/.test(text))fail.push("browser persistence API remains in runtime source");
if(/BACKEND_DISABLED|mockData/i.test(text))fail.push("legacy demo/backend-disabled source remains");

const pkg=JSON.parse(read("package.json"));
const lock=JSON.parse(read("package-lock.json"));
if(pkg.name!=="zenix-pos-web")fail.push("frontend package name is not zenix-pos-web");
if(lock.name!==pkg.name||lock.packages?.[""]?.name!==pkg.name)fail.push("package-lock root name does not match package.json");

const env=read("../backend/src/config/env.js");
for(const key of ["FRONTEND_ORIGIN","TELEGRAM_BOT_TOKEN","TELEGRAM_WEBHOOK_SECRET","PUBLIC_API_URL"]){
  if(!env.includes(`productionValue("${key}"`))fail.push(`${key} is not fail-closed in production`);
}
const app=read("../backend/src/app.js");
if(!app.includes('app.get("/ready"'))fail.push("database readiness endpoint missing");
if(app.includes('/api/activity'))fail.push("generic forgeable activity endpoint is mounted");
const telegram=read("../backend/src/routes/telegram.js");
if(!telegram.includes("startgroup"))fail.push("Telegram group-picker deep link missing");
if(!telegram.includes('router.post("/webhook"'))fail.push("Telegram webhook missing");
if(!telegram.includes("migrate_to_chat_id"))fail.push("Telegram group-to-supergroup migration handling missing");
const migrationFiles=fs.readdirSync(path.join(repoRoot,"backend/migrations")).filter((name)=>name.endsWith(".sql")).sort();
if(migrationFiles.length<8)fail.push("production database migration set is incomplete");

if(fail.length){console.error(JSON.stringify({ok:false,issues:fail},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checkedFiles:files.length,brand:"Zenix POS",telegram:"@zenixposbot",browserBusinessPersistence:false},null,2));
