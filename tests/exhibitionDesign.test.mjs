import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('design tokens are loaded in bootstrap independently of the lazy shell',()=>{
  const global=read('src/index.css'),shell=read('src/layout/mainlayout.scss');
  assert.match(read('src/main.jsx'),/import "\.\/index\.css"/);
  for(const key of ['bg','card-bg','text','muted','primary','surface','border','accent-soft'])assert.match(global,new RegExp('--'+key+':'));
  assert.match(global,/body\.dark-mode\s*\{[\s\S]*--bg:#111315/);
  assert.doesNotMatch(shell,/--card-bg:/);
});
test('authentication uses existing brand and recovery is centered without shell',()=>{
  for(const path of ['src/pages/login/Login.jsx','src/pages/register/Register.jsx','src/pages/login/ChangePassword.jsx','src/pages/login/ResetPassword.jsx'])assert.match(read(path),/src="\/zenix-logo\.png"/);
  assert.match(read('src/pages/login/ResetPassword.jsx'),/auth-reset-page/);
  assert.match(read('src/pages/login/login.scss'),/\.auth-page\.auth-reset-page\{grid-template-columns:minmax\(0,1fr\)\}/);
});
test('dashboard keeps complete KPI values visible',()=>{
  const css=read('src/pages/dashboard/dashboard.scss');
  assert.match(css,/\.dashboard-pro \.dashboard-kpis \.pro-stat strong\{[\s\S]*white-space:normal;overflow:visible;text-overflow:clip/);
});
