import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleChatScroll} from '../src/pages/ai/aiScroll.js';

test('following a reply defers layout reads until a frame and uses the latest height',()=>{
 let frame,reads=0,height=100;const node={scrollTop:0,get scrollHeight(){reads++;return height;}};
 scheduleChatScroll(node,false,callback=>{frame=callback;return 7;},()=>{});
 assert.equal(reads,0,'sending feedback can commit without forcing scroll layout');
 assert.equal(node.scrollTop,0);height=220;frame();
 assert.equal(reads,1);assert.equal(node.scrollTop,220);
});

test('resetting an empty chat avoids height reads; cleanup cancels stale frame',()=>{
 let frame,cancelled;const node={scrollTop:90,get scrollHeight(){throw Error('reset must not read layout');}};
 const cancel=scheduleChatScroll(node,true,callback=>{frame=callback;return 8;},id=>{cancelled=id;});
 assert.equal(node.scrollTop,90);frame();assert.equal(node.scrollTop,0);
 cancel();assert.equal(cancelled,8);
});

test('a reader who scrolls away before the frame keeps their position',()=>{
 let frame,following=true;const node={scrollTop:25,get scrollHeight(){throw Error('reader position must not be measured or changed');}};
 scheduleChatScroll(node,false,callback=>{frame=callback;return 9;},()=>{},()=>following);
 following=false;frame();assert.equal(node.scrollTop,25);
});
