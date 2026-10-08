import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

// Backend contract tests are available only for a side-by-side checkout.
// The standalone frontend CI suite must never require an embedded backend.
const crossRepoTests=new Set([
  "customerSmartPlatform.test.mjs", "deepAudit.test.mjs",
  "fiftyThreeFixesRegression.test.mjs", "finalFixRegression.test.mjs",
  "integrityHardening.test.mjs", "performanceHardening.test.mjs",
  "deploymentBoundary.test.mjs",
]);
const all=process.argv.includes("--with-backend");
const candidates=fs.readdirSync("tests").filter(name=>name.endsWith(".test.mjs"));
const selected=candidates.filter(name=>all||!crossRepoTests.has(name));
if(all&&!fs.existsSync(path.resolve("../backend/package.json"))){
  console.error("Backend integration tests need a sibling ../backend checkout.");
  process.exit(1);
}
console.log(`Running ${selected.length} ${all?"combined":"standalone"} test files (${candidates.length-selected.length} cross-repo files excluded from standalone CI).`);
const run=spawnSync(process.execPath,["--test",...selected.map(name=>path.join("tests",name))],{stdio:"inherit",env:process.env});
process.exit(run.status??1);
