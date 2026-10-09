import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, copyFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

test("design verification accepts LF and CRLF exports but detects actual style drift", async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),"zenix-design-eol-"));
  try {
    await mkdir(path.join(directory,"scripts"));await mkdir(path.join(directory,"src"));
    await copyFile(new URL("../scripts/verify-design.mjs",import.meta.url),path.join(directory,"scripts/verify-design.mjs"));
    const windowsStyles=".page {\r\n  gap: 12px;\r\n}\r\n";
    const baseline=createHash("sha256").update(windowsStyles).digest("hex");
    await writeFile(path.join(directory,"design-baseline.json"),JSON.stringify({"src/page.scss":baseline}));
    const verify=()=>spawnSync(process.execPath,[path.join(directory,"scripts/verify-design.mjs")],{encoding:"utf8"});
    for(const styles of [windowsStyles, ".page {\n  gap: 12px;\n}\n"]) {
      await writeFile(path.join(directory,"src/page.scss"),styles);
      const result=verify();assert.equal(result.status,0,result.stderr);
      assert.match(result.stdout,/Visual baseline PASS: 1/);
    }
    await writeFile(path.join(directory,"src/page.scss"),".page {\n  gap: 13px;\n}\n");
    const drift=verify();assert.equal(drift.status,1);assert.match(drift.stderr,/src\/page.scss/);
  } finally { await rm(directory,{recursive:true,force:true}); }
});
