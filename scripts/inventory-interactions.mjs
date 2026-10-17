// Static candidate inventory: dynamic labels and conditional reachability need manual review.
import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('src');
const output=path.resolve(process.env.ZENIX_PLATFORM_ARTIFACTS||'../artifacts/performance-continuation-20261016');
async function files(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?files(path.join(dir,e.name)):/\.[jt]sx?$/.test(e.name)?[path.join(dir,e.name)]:[]))).flat();}
const controls=[],pages=[];
for(const file of await files(root)){
 const source=await readFile(file,'utf8'),relative=path.relative(process.cwd(),file).replaceAll('\\','/');
 if(relative.startsWith('src/pages/'))pages.push(relative);
 const pattern=/<([A-Za-z][\w.]*)\b/g;let match;
 while((match=pattern.exec(source))){
  let end=pattern.lastIndex,depth=0,quote='';
  for(;end<source.length;end++){const ch=source[end];if(quote){if(ch==='\\'){end++;continue}if(ch===quote)quote='';continue}if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue}if(ch==='{')depth++;if(ch==='}')depth--;if(ch==='>'&&depth===0)break;}
  const tag=source.slice(match.index,end+1),type=match[1];pattern.lastIndex=end+1;
  if(!/^(button|input|select|textarea|a|summary|form|Link|NavLink)$/.test(type)&&!/(?:onClick|onChange|onSubmit|onKeyDown|tabIndex|role\s*=\s*["'](?:button|link|menuitem|switch|checkbox))\s*=/.test(tag))continue;
  const text=source.slice(end+1,source.indexOf('<',end+1)).trim();
  const attributes=[...tag.matchAll(/\b(aria-label|title|placeholder|type|to|href|name|role)\s*=\s*("[^"]*"|'[^']*'|\{[^}]*\})/g)].map(m=>[m[1],m[2]]);
  controls.push({file:relative,line:source.slice(0,match.index).split('\n').length,type,label:text||Object.fromEntries(attributes)['aria-label']||Object.fromEntries(attributes).placeholder||null,attributes:Object.fromEntries(attributes),handlers:[...tag.matchAll(/\b(on\w+)\s*=/g)].map(m=>m[1]),source:tag});
 }
}
await mkdir(output,{recursive:true});
await writeFile(path.join(output,'interaction-inventory.json'),JSON.stringify({scope:'All src pages and shared source; lexical JSX candidates, not runtime exhaustive coverage. Expressions retained verbatim; repeated controls represented once per source site.',pages,controls},null,2));
await writeFile(path.join(output,'interaction-inventory.md'),`Static interaction inventory: ${controls.length} source sites; ${pages.length} page source files.\n\nConditional controls and dynamically generated labels require runtime review. Full file/line/type/label/source details are in interaction-inventory.json.\n\n`+pages.map(file=>`${file}: ${controls.filter(c=>c.file===file).length} direct interaction sites`).join('\n'));
console.log(JSON.stringify({pages:pages.length,controls:controls.length,output}));
