import test from 'node:test';
import assert from 'node:assert/strict';
import {settingsChanges,canApplySettingsRead} from '../src/utils/settingsPersistence.js';
const baseline={identity:'a',workspaceSettings:'{}',businessFeatures:'{}',rolePermissions:'{}'};
test('settings change detection uses acknowledged snapshot and owner scope',()=>{
 const current={...baseline,workspaceSettings:'{"pos":1}',rolePermissions:'{"CASHIER":{}}'};
 assert.deepEqual(settingsChanges(current,baseline,false),['workspaceSettings']);
 assert.deepEqual(settingsChanges(current,baseline,true),['workspaceSettings','rolePermissions']);
});
test('a late refresh cannot overwrite pending edits or an acknowledged newer write',()=>{
 const options={identity:'a',baseline,current:baseline,readRevision:1,revision:1,owner:true};
 assert.equal(canApplySettingsRead(options),true);
 assert.equal(canApplySettingsRead({...options,current:{...baseline,businessFeatures:'{"variants":true}'}}),false);
 assert.equal(canApplySettingsRead({...options,revision:2}),false);
 assert.equal(canApplySettingsRead({...options,identity:'b'}),true);
});
