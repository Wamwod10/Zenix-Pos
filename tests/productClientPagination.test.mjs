import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/pages/products/Products.jsx',import.meta.url),'utf8');
test('product screen limits rendered grid/table rows and preserves existing UI styling',()=>{
  assert.match(src,/const productsPerPage=48/);
  assert.match(src,/filtered\.slice\(\(productPage-1\)\*productsPerPage,productPage\*productsPerPage\)/);
  assert.equal((src.match(/visiblePageProducts\.map\(/g)||[]).length,3); // selection + two display modes
  assert.match(src,/platform-pagination/);
  assert.match(src,/setProductPage\(1\)/);
});
