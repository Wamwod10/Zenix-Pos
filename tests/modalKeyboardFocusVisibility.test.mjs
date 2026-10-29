import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('shared modal traps keyboard focus and ignores hidden responsive controls',()=>{
 const source=readFileSync(new URL('../src/components/Modal.jsx',import.meta.url),'utf8');
 assert.match(source,/el\.closest\('\[hidden\],\[inert\],\[aria-hidden="true"\]'\)/);
 assert.match(source,/el\.getClientRects\(\)\.length\s*>\s*0/);
 assert.match(source,/window\.getComputedStyle\(el\)\.visibility\s*!==\s*"hidden"/);
 assert.match(source,/focusables\(\)\.find\(/,'autofocus must use visible focusable list');
 assert.match(source,/if \(!list\.length\) \{ event\.preventDefault\(\); node\?\.focus\(\); return; \}/);
 assert.match(source,/if \(!list\.includes\(document\.activeElement\)\)/);
 assert.match(source,/event\.shiftKey \? last : first/);
 assert.match(source,/tabIndex=\{-1\}/,'dialog itself must support focus fallback');
 assert.match(source,/top !== node/,'only the topmost nested modal handles Escape or Tab');
 assert.match(source,/previous\?\.focus\?\.\(\)/,'restore prior focus after closing');
});
