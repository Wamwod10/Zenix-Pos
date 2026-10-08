// Regression guard: Zenix's checked-in visual tokens and styles must not drift
// during backend/API repairs. Deliberate design changes require a reviewed
// baseline update, never an automatic rewrite of the original style files.
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await readFile(path.join(root,'design-baseline.json'),'utf8'));
const collected=[];
async function scan(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const full=path.join(directory,entry.name);
    if(entry.isDirectory())await scan(full);
    else if(entry.isFile()&&/\.(css|scss)$/.test(entry.name)){
      const relative=path.relative(root,full).replaceAll(path.sep,'/');
      collected.push([relative,createHash('sha256').update(await readFile(full)).digest('hex')]);
    }
  }
}
await scan(path.join(root,'src'));
collected.sort((a,b)=>a[0].localeCompare(b[0],'en'));
const actual=Object.fromEntries(collected);
const changed=Object.keys(actual).filter(name=>actual[name]!==manifest[name]);
const removed=Object.keys(manifest).filter(name=>!(name in actual));
if(changed.length||removed.length){
  console.error('Visual baseline mismatch:',{changed,removed});
  process.exitCode=1;
}else console.log(`Visual baseline PASS: ${collected.length} CSS/SCSS files match`);
