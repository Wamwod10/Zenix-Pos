import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');

test('authenticated dashboard shell loads only after Protected permits a route',()=>{
  assert.match(app,/const MainLayout=lazy\(\(\)=>import\("\.\/layout\/MainLayout"\)\)/);
  assert.doesNotMatch(app,/import MainLayout from/);
  assert.match(app,/<Protected><MainLayout\/><\/Protected>/);
  assert.match(app,/<Suspense fallback=\{<Fallback\/>\}>/);
  assert.match(app,/<Route path="\/pos-pro" element=\{<Protected>/);
});

test('lazy layout does not change root auth or POS store ownership',()=>{
  assert.match(main,/<AuthProvider><StoreProvider><FeedbackProvider><App \/>/);
  assert.match(app,/<Route path="\/login" element=\{<Login\/>\}/);
  assert.match(app,/<Route path="\/register" element=\{<Register\/>\}/);
});
