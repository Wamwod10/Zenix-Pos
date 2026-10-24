import test from 'node:test';
import assert from 'node:assert/strict';
import {formatChartTick} from '../src/utils/formatChartTick.js';
test('chart ticks distinguish zero, sub-thousand, small and large values',()=>{
 const values=[0,0.25,0.5,0.75,1,250,500,750,1000,1500,1000000];
 assert.equal(new Set(values.map(formatChartTick)).size,values.length);
 assert.equal(formatChartTick(0),'0');
 assert.equal(formatChartTick(1000),'1k');
 assert.equal(formatChartTick(1500),'1.5k');
 assert.equal(formatChartTick(1000000),'1M');
});
