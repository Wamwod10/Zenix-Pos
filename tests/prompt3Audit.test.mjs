import test from 'node:test';import assert from 'node:assert/strict';import * as audit from '../src/utils/auditChanges.js';
test('audit omits empty differences and retains zero as real data',()=>{
 assert.equal(typeof audit.hasAuditValue,'function');
 for(const value of [null,undefined,'',{},[]])assert.equal(audit.hasAuditValue(value),false);
 assert.equal(audit.hasAuditValue(0),true);
 assert.equal(audit.normalizeActivityChanges([{field:'empty',before:null,after:null},{field:'quantity',before:30,after:15}]).length,1);
});
