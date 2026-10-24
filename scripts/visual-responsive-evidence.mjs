// Preserve selected evidence in the repository; leave existing baselines intact.
import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root='../artifacts/visual-fix-2026',target='artifacts/visual-fix-2026';
const cases=[
 ['390-pos-pro-light.png','before','release'],['390-pos-pro-dark.png','before','release'],
 ['390-dashboard-light.png','before','release'],['390-dashboard-dark.png','before','release'],
 ['1366-dashboard-light.png','before','header-final'],['1366-pos-pro-light.png','before','release'],
 ['320-products-light.png','before','release'],['768-sales-light.png','before','release'],
 ['390-customer-dropdown.png','sales-before','release'],['320-login-light.png','auth-before','release'],
 ['820-sales-light.png','collision-diagnostic','collision-after'],
];
for(const phase of ['before','after','diff'])await mkdir(`${target}/${phase}`,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(process.platform==='win32'?'C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe':undefined)});
const summary=[];
try{const page=await browser.newPage();
 for(const [name,before,after] of cases){
  const a=await readFile(`${root}/${before}/${name}`),b=await readFile(`${root}/${after}/${name}`);
  await writeFile(`${target}/before/${name}`,a);await writeFile(`${target}/after/${name}`,b);
  const result=await page.evaluate(async([a,b])=>{
   const decode=async data=>{const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();return img};
   const [old,next]=await Promise.all([decode(a),decode(b)]),width=Math.max(old.width,next.width),height=Math.max(old.height,next.height);
   const draw=img=>{const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.drawImage(img,0,0);return ctx.getImageData(0,0,width,height)};
   const x=draw(old),y=draw(next),c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d'),d=ctx.createImageData(width,height);let changed=0;
   for(let i=0;i<x.data.length;i+=4){const delta=Math.max(...[0,1,2].map(k=>Math.abs(x.data[i+k]-y.data[i+k]))),hit=delta>24;if(hit)changed++;d.data[i]=hit?210:Math.round(y.data[i]*.25+190);d.data[i+1]=hit?45:Math.round(y.data[i+1]*.25+190);d.data[i+2]=hit?100:Math.round(y.data[i+2]*.25+190);d.data[i+3]=255}
   ctx.putImageData(d,0,0);return {png:c.toDataURL('image/png').split(',')[1],width,height,beforeHeight:old.height,afterHeight:next.height,changedPixels:changed};
  },[a.toString('base64'),b.toString('base64')]);
  const {png,...metrics}=result;await writeFile(`${target}/diff/${name}`,Buffer.from(png,'base64'));summary.push({name,...metrics});
 }
}finally{await browser.close()}
await writeFile(`${target}/diff/summary.json`,JSON.stringify({note:'Full-page pixel differences include intended vertical reflow and live header clocks. Not an exact screenshot equality assertion.',cases:summary},null,2));
console.log(`Preserved ${summary.length} before/after/diff triplets`);
