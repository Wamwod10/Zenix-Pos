import test from 'node:test';import assert from 'node:assert/strict';import {customerSegmentOptions,normalizeCustomerSegment} from '../src/pages/customers/customerSegments.js';
test('reengagement options retain legacy active/inactive and expose distinct recent-sale filters',()=>{
 const ids=customerSegmentOptions.map(([id])=>id);assert.equal(new Set(ids).size,ids.length);
 for(const id of ['active','inactive','new-30','never-purchased','lapsed-30','lapsed-60','lapsed-90'])assert.equal(normalizeCustomerSegment(id),id);
 assert.equal(normalizeCustomerSegment('lapsed-999'),'all');
});
