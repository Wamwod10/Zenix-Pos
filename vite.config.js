import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import path from 'node:path'

// Precache only the entry point and its static bootstrap dependencies.
// Dynamically imported POS, billing, admin and analytics modules are cached on demand.
// Preloading all compiled chunks makes installing the service worker download the entire app.
export const entryPrecacheAssets=(html)=>[...new Set(
  [...html.matchAll(/\b(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map(match=>match[1])
)];

const pwaAssetPrecache=()=>({
  name:'zenix-pwa-asset-precache',
  apply:'build',
  async closeBundle(){
    const dist=path.resolve('dist');
    const html=await fs.readFile(path.join(dist,'index.html'),'utf8');
    const urls=entryPrecacheAssets(html);
    if(!urls.some(url=>url.endsWith('.js'))||!urls.some(url=>url.endsWith('.css'))||urls.length>12){
      throw new Error('Unexpected PWA entry asset list; refuse to precache the entire application');
    }
    const swPath=path.join(dist,'sw.js');
    const sw=await fs.readFile(swPath,'utf8');
    const anchor='const BUILD_ASSETS = [];';
    if(!sw.includes(anchor))throw new Error('Service worker precache placeholder missing');
    await fs.writeFile(swPath,sw.replace(anchor,`const BUILD_ASSETS = ${JSON.stringify(urls)};`));
  }
})

export const previewBuildDefines=(source=process.env)=>source.VERCEL_ENV==='preview'?{'import.meta.env.VITE_API_URL':'""'}:{}

// Related lazy administration/report pages share compressed code, while their
// dependencies remain in automatic chunks. Never capture startup dependencies.
const lazyPageGroups={includeDependenciesRecursively:false,groups:[
  {name:'settings-center',test:/[\\/]src[\\/]pages[\\/](settings|profile|activityLog|help)[\\/]/},
  {name:'report-center',test:/[\\/]src[\\/]pages[\\/](analytics|sellerAnalytics)[\\/].*\.jsx$/},
]};
export default defineConfig({plugins:[react(),pwaAssetPrecache()],define:previewBuildDefines(),build:{rolldownOptions:{output:{codeSplitting:lazyPageGroups}}}})
