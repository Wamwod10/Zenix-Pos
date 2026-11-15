import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {entryPrecacheAssets} from '../vite.config.js';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('landing HTML provides a real Uzbek meta description and viewport',()=>{
  const html=read('index.html');
  assert.match(html,/<html lang="uz">/);
  assert.match(html,/<meta name="description" content="ZENIX POS[^"]+"/);
  assert.match(html,/name="viewport"/);
});

test('robots.txt is parseable plain text and does not advertise private POS routes',()=>{
  const robots=read('public/robots.txt');
  assert.match(robots,/^User-agent: \*$/m);
  assert.match(robots,/^Allow: \/$/m);
  for(const path of ['/api/','/pos-pro','/platform','/billing','/customers','/products']){
    assert.ok(robots.includes('Disallow: '+path),path);
  }
  assert.doesNotMatch(robots,/<(?:html|head|body)/i);
  assert.doesNotMatch(robots,/Disallow: \/\s*$/m);
});

test('sitemap and AI discovery files only refer to public pages and do not invent agent APIs',()=>{
  const sitemap=read('public/sitemap.xml');
  assert.match(sitemap,/<\?xml version="1\.0"/);
  assert.match(sitemap,/<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(sitemap,/https:\/\/www\.zenixpos\.uz\/register/);
  assert.doesNotMatch(sitemap,/\/api\/|\/platform|\/billing/);
  const llms=read('public/llms.txt');
  assert.match(llms,/^# ZENIX POS$/m);
  assert.match(llms,/\[Register and start a trial\]\(https:\/\/www\.zenixpos\.uz\/register\)/);
  const ard=JSON.parse(read('public/.well-known/ard.json'));
  assert.deepEqual(ard,{entries:[]});
});

test('PWA precaches only the Vite index entry and imports, not 60+ lazy chunks',()=>{
  const builtHtml=[
    '<script type="module" crossorigin src="/assets/index-a.js"></script>',
    '<link rel="modulepreload" crossorigin href="/assets/AuthContext-b.js">',
    '<link rel="modulepreload" crossorigin href="/assets/jsx-runtime-c.js">',
    '<link rel="stylesheet" crossorigin href="/assets/index-d.css">',
    '<link rel="stylesheet" crossorigin href="/assets/index-d.css">'
  ].join('\n');
  assert.deepEqual(entryPrecacheAssets(builtHtml),[
    '/assets/index-a.js','/assets/AuthContext-b.js','/assets/jsx-runtime-c.js','/assets/index-d.css'
  ]);
  const source=read('vite.config.js');
  assert.doesNotMatch(source,/readdir\(assets\)/);
  assert.match(source,/urls\.length>12/);
  assert.match(read('public/sw.js'),/CACHE_PREFIX\}v5/);
});

test('Vercel uses immutable asset hashes and refuses stale service worker caching',()=>{
  const config=JSON.parse(read('vercel.json'));
  const findHeader=(source,key)=>config.headers.find(row=>row.source===source)?.headers.find(row=>row.key===key)?.value;
  assert.equal(findHeader('/assets/(.*)','Cache-Control'),'public, max-age=31536000, immutable');
  assert.equal(findHeader('/sw.js','Cache-Control'),'public, max-age=0, must-revalidate');
  assert.equal(findHeader('/(.*)','X-Frame-Options'),'DENY');
  assert.equal(findHeader('/(.*)','X-Content-Type-Options'),'nosniff');
  const csp=findHeader('/(.*)','Content-Security-Policy');
  assert.match(csp,/frame-ancestors 'none'/);
  assert.match(csp,/base-uri 'self'/);
  assert.match(csp,/object-src 'none'/);
  assert.ok(config.rewrites.some(row=>row.source==='/api/:path*'),'Proxy rewrite preserved');
  assert.ok(config.rewrites.some(row=>row.source==='/(.*)'),'SPA rewrite preserved');
});

test('loading skeleton animates only compositor-friendly opacity, never painted gradients',()=>{
  const css=read('src/styles/saas.scss');
  assert.match(css,/animation:zenixSkeletonPulse 1\\.6s ease-in-out infinite/);
  assert.match(css,/@keyframes zenixSkeletonPulse\\{0%,100%\\{opacity:1\\}50%\\{opacity:\\.73\\}\\}/);
  assert.doesNotMatch(css,/@keyframes zenixSkeleton\\{[^}]*background-position/);
  assert.doesNotMatch(css,/background-size:220% 100%;animation:zenixSkeleton/);
  assert.match(css,/@media \\(prefers-reduced-motion: reduce\\)/);
});
