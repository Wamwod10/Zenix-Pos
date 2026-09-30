import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import path from 'node:path'

const pwaAssetPrecache=()=>({
  name:'zenix-pwa-asset-precache',
  apply:'build',
  async closeBundle(){
    const dist=path.resolve('dist');
    const assets=path.join(dist,'assets');
    let names=[];try{names=await fs.readdir(assets)}catch{return}
    const urls=names.filter(name=>/\.(?:js|css|woff2?|png|svg|webp)$/i.test(name)).map(name=>`/assets/${name}`);
    const swPath=path.join(dist,'sw.js');
    let sw=await fs.readFile(swPath,'utf8');
    sw=sw.replace('const BUILD_ASSETS = [];',`const BUILD_ASSETS = ${JSON.stringify(urls)};`);
    await fs.writeFile(swPath,sw);
  }
})

export default defineConfig({plugins:[react(),pwaAssetPrecache()]})
