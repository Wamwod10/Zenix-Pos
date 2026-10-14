import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';

test('floating AI keeps its right lane clear of checkout and mobile controls',async t=>{
 const vite=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
 try{
  const {launcherPlacement}=await vite.ssrLoadModule('/src/components/ZenixAILauncher.jsx');
  const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
  await t.test('desktop rests 24px from the bottom when unobstructed',()=>assert.deepEqual(launcherPlacement({width:1440,height:900}),{bottom:24,hidden:false}));
  await t.test('checkout and neighboring stacked controls lift the launcher',()=>{
   const result=launcherPlacement({width:1440,height:900,obstacles:[rect(1100,820,316,64),rect(1100,755,316,50)]});
   assert.deepEqual(result,{bottom:153,hidden:false});
  });
  await t.test('mobile payment bar and bottom navigation remain accessible',()=>{
   const result=launcherPlacement({width:390,height:844,right:16,edge:16,obstacles:[rect(0,780,390,64),rect(12,714,366,58)]});
   assert.deepEqual(result,{bottom:138,hidden:false});
  });
  await t.test('hidden or other-lane controls do not displace it',()=>assert.deepEqual(launcherPlacement({width:1440,height:900,obstacles:[rect(30,820,100,64),rect(1400,800,0,0)]}),{bottom:24,hidden:false}));
  await t.test('no available right lane hides floating control rather than covering a button',()=>assert.equal(launcherPlacement({width:320,height:200,obstacles:[rect(0,0,320,200)]}).hidden,true));
 }finally{await vite.close()}
});
